'use strict';

// Notification blinks, plus the bookkeeping a notifier needs to be safe to fire
// from an editor hook or a cron job: restore the state it found, refuse to
// overlap with itself, and stay quiet during a mute window.
//
// This is the engine behind `kbdlight pulse`. The keyboard is a shared resource
// on a machine you are using, so every guarantee here exists because breaking
// it leaves the hardware in a state the user did not choose.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const kbd = require('./index.js');

const LOCK = path.join(os.tmpdir(), 'kbdlight-pulse.lock');
const LOCK_STALE_MS = 10000;
// Not in tmpdir: a mute is meant to outlive a reboot or a temp sweep.
const MUTE_FILE = path.join(os.homedir(), '.kbdlight-pulse-mute');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- mute -----------------------------------------------------------------

// "09:00" means the next 09:00 to come, today or tomorrow. Anything else is
// handed to Date, so full ISO timestamps work too.
function parseUntil(input) {
  const hm = /^(\d{1,2}):(\d{2})$/.exec(String(input).trim());
  if (hm) {
    const at = new Date();
    at.setHours(Number(hm[1]), Number(hm[2]), 0, 0);
    if (at <= new Date()) at.setDate(at.getDate() + 1);
    return at;
  }
  const at = new Date(input);
  if (isNaN(at.getTime())) throw new Error('cannot parse a time from "' + input + '"');
  return at;
}

function muteUntil(date) {
  fs.writeFileSync(MUTE_FILE, date.toISOString() + '\n');
  return date;
}

function unmute() {
  try {
    fs.unlinkSync(MUTE_FILE);
    return true;
  } catch (e) {
    return false; // was not muted
  }
}

// Returns the end of an active mute, or null. An expired mute deletes itself,
// so nothing has to be cleaned up by hand or scheduled to run later.
function mutedUntil() {
  let until;
  try {
    until = new Date(fs.readFileSync(MUTE_FILE, 'utf8').trim());
  } catch (e) {
    return null; // no mute file
  }
  if (isNaN(until.getTime())) return null; // garbage in the file is not a mute
  if (until > new Date()) return until;
  unmute();
  return null;
}

const isMuted = () => mutedUntil() !== null;

// --- lock -----------------------------------------------------------------

// Two overlapping runs would be a real bug rather than merely ugly: the second
// one would snapshot the keyboard mid-blink, see level 0, and "restore" the
// machine to dark on its way out.
function acquireLock() {
  try {
    fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' }); // atomic
    return true;
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
  try {
    // A crashed run can leave the file behind, so an old lock is not a lock.
    if (Date.now() - fs.statSync(LOCK).mtimeMs < LOCK_STALE_MS) return false;
    fs.writeFileSync(LOCK, String(process.pid));
    return true;
  } catch (e) {
    return false;
  }
}

function releaseLock() {
  try {
    fs.unlinkSync(LOCK);
  } catch (e) {
    /* already gone */
  }
}

// --- detach ---------------------------------------------------------------

// Hook runners wait for the command to exit before they continue, and blinking
// takes about a second. Re-spawn ourselves detached and return immediately.
//
// stdin is drained first: a hook runner writes its JSON payload there, and
// exiting without reading it hands the writer an EPIPE.
function detachAndExit(args) {
  const script = process.argv[1];
  const go = () => {
    const child = spawn(process.execPath, [script].concat(args), {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    process.exit(0);
  };
  const timer = setTimeout(go, 200); // safety net if stdin never ends
  timer.unref();
  process.stdin.on('error', () => {});
  process.stdin.on('data', () => {});
  process.stdin.on('end', () => {
    clearTimeout(timer);
    go();
  });
  process.stdin.resume();
}

// --- blink ----------------------------------------------------------------

// Hard on, hard off, N times, then exactly the state we found.
//
// Not a fade: a ramp looks better when you are staring at the keyboard, but in
// peripheral vision the eye integrates it into a vague glow and you miss the
// notification entirely, which is the only thing it was for.
//
// The timing is slow on purpose. The hardware is not the constraint: measured
// through `backlightLevelForKeyboard:`, which reports the driver's real output
// rather than the value we asked for, the LEDs reach full within 26 ms and drop
// just as fast. The constraint is the room. A backlight competing with daylight
// needs a full second of lit time before someone who is not looking at the
// keyboard registers that anything happened.
async function blink(opts = {}) {
  const count = opts.count != null ? Number(opts.count) : 4;
  const peak = opts.peak != null ? Number(opts.peak) : 1;
  const onMs = opts.onMs != null ? Number(opts.onMs) : 1000;
  const offMs = opts.offMs != null ? Number(opts.offMs) : 500;
  // A dark phase before the first flash. Coming up from black reads as brighter
  // than the same flash coming up from a keyboard that was already lit, and it
  // separates the notification from whatever the backlight was doing before.
  const preDarkMs = opts.preDarkMs != null ? Number(opts.preDarkMs) : 400;

  if (!Number.isFinite(count) || count < 1) throw new Error('count must be 1 or more');

  if (isMuted()) return { blinked: false, reason: 'muted' };
  if (!acquireLock()) return { blinked: false, reason: 'already running' };

  let saved;
  try {
    // Level and auto-brightness are per keyboard, and a Mac can have several.
    saved = kbd.keyboardIDs().map((id) => ({
      id,
      level: kbd.get(id),
      auto: kbd.isAuto(id),
    }));
  } catch (e) {
    releaseLock();
    throw e;
  }

  if (!saved.length) {
    releaseLock();
    return { blinked: false, reason: 'no backlit keyboard' };
  }

  let restored = false;
  const restore = () => {
    if (restored) return; // the exit handlers can fire more than once
    restored = true;
    for (const k of saved) {
      kbd.set(k.level, k.id);
      // Auto last: enabling it hands the level back to the ambient sensor, so
      // writing the level after that would just be overwritten.
      kbd.setAuto(k.auto, k.id);
    }
    releaseLock();
  };

  process.on('exit', restore);
  process.on('SIGINT', () => {
    restore();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    restore();
    process.exit(143);
  });

  try {
    // The ambient sensor would fight every write, so it is off for the blinks.
    for (const k of saved) if (k.auto) kbd.setAuto(false, k.id);

    if (preDarkMs > 0) {
      for (const k of saved) kbd.set(0, k.id);
      await sleep(preDarkMs);
    }

    for (let i = 0; i < count; i++) {
      for (const k of saved) kbd.set(peak, k.id);
      await sleep(onMs);
      for (const k of saved) kbd.set(0, k.id);
      await sleep(offMs);
    }
  } finally {
    restore();
  }

  return { blinked: true, count: count };
}

module.exports = {
  blink,
  detachAndExit,
  parseUntil,
  muteUntil,
  unmute,
  mutedUntil,
  isMuted,
  MUTE_FILE,
};
