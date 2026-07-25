'use strict';

// Shared plumbing for the examples: a "session" owns the keyboard for the life
// of a script and guarantees the machine is handed back exactly as it was.
//
// Two things make this less trivial than it looks:
//
//   1. Level and auto-brightness are per keyboard, and a Mac can have more than
//      one backlit keyboard attached. So state is snapshotted per keyboard ID.
//   2. Ambient auto-brightness actively fights manual writes, so it has to be
//      switched off while an effect runs and switched back on afterwards.
//
// Restore runs on the normal path, on Ctrl-C, on SIGTERM, and on a crash.

const kbd = require('../../src/index.js');

const STEP_MS = 16; // ~60 writes/sec, the granularity every ramp is built from

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v) => Math.max(0, Math.min(1, v));

// Opens a session: snapshots every keyboard, disables auto-brightness, and
// installs the exit handlers that put it all back.
function session() {
  const saved = kbd.keyboardIDs().map((id) => ({
    id,
    level: kbd.get(id),
    auto: kbd.isAuto(id),
  }));

  if (!saved.length) throw new Error('no backlit keyboard found');

  const self = {
    stopped: false,
    ids: saved.map((k) => k.id),
  };

  let restored = false;

  self.restore = function restore() {
    if (restored) return; // the exit handlers can fire more than once
    restored = true;
    for (const k of saved) {
      kbd.set(k.level, k.id);
      // Auto last: enabling it hands the level back to the ambient sensor, so
      // writing the level after that would just be overwritten.
      kbd.setAuto(k.auto, k.id);
    }
  };

  // Ctrl-C sets a flag instead of exiting, so loops can finish the frame they
  // are on and unwind through their own finally block.
  process.on('SIGINT', () => {
    self.stopped = true;
  });
  process.on('SIGTERM', () => {
    self.restore();
    process.exit(130);
  });
  process.on('exit', self.restore);
  process.on('uncaughtException', (e) => {
    self.restore();
    throw e;
  });

  for (const k of saved) if (k.auto) kbd.setAuto(false, k.id);

  // Writes to every keyboard using the IDs resolved once at snapshot time, so
  // the hot loop never re-queries the Objective-C keyboard list per frame.
  self.write = function write(level) {
    const v = clamp(level);
    for (const k of saved) kbd.set(v, k.id);
  };

  // Linear ramp between two levels over `ms`.
  self.ramp = async function ramp(from, to, ms) {
    const steps = Math.max(1, Math.round(ms / STEP_MS));
    for (let i = 1; i <= steps && !self.stopped; i++) {
      self.write(from + (to - from) * (i / steps));
      await sleep(ms / steps);
    }
  };

  // One hard blink: full on, hold, full off, hold. No ramps.
  //
  // Ramps look better in isolation but read as weak on a keyboard you are not
  // staring at: the eye integrates the fade and the whole thing registers as a
  // slight glow. A square edge is what actually catches attention.
  self.blink = async function blink(opts = {}) {
    const peak = opts.peak != null ? opts.peak : 1;
    const onMs = opts.onMs != null ? opts.onMs : 110;
    const offMs = opts.offMs != null ? opts.offMs : 110;
    self.write(peak);
    await sleep(onMs);
    self.write(0);
    await sleep(offMs);
  };

  // One pulse: quick ramp up, slower ramp down, dark afterwards. Short attack
  // plus long decay is what makes it read as a beat instead of a blink.
  self.pulse = async function pulse(opts = {}) {
    const peak = opts.peak != null ? opts.peak : 1;
    const attackMs = opts.attackMs != null ? opts.attackMs : 45;
    const decayMs = opts.decayMs != null ? opts.decayMs : 130;
    await self.ramp(0, peak, attackMs);
    await self.ramp(peak, 0, decayMs);
  };

  return self;
}

module.exports = { session, sleep, clamp, STEP_MS };
