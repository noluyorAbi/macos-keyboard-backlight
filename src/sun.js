'use strict';

// Sun mode: the keyboard follows the sky.
//
// WHAT IT DOES
//   After sunset the backlight comes up to a level you pick; after sunrise it
//   goes back down, dark by default, because a backlight competing with
//   daylight is only spending battery. Sunrise and sunset come from your
//   coordinates, so the switch tracks the season instead of a clock time that
//   was right in March and an hour wrong by June.
//
// WHY A POLLING AGENT AND NOT TWO SCHEDULED TIMES
//   Sunrise moves by a couple of minutes a day, so a job pinned to a clock time
//   has to rewrite itself daily, and every rewrite is another chance to leave a
//   schedule that is wrong, doubled, or gone. A launchd agent that wakes every
//   few minutes and asks "which side of the sun are we on" cannot drift, never
//   needs re-arming, and catches up on the first wake if the Mac slept through
//   the moment. launchd also runs a missed interval at the next wake instead of
//   skipping it, which is exactly the behaviour a sunset switch wants.
//
// WHY IT ONLY WRITES ON A TRANSITION
//   Between two ticks the keyboard is yours. The agent touches it when the
//   phase changes, not on every tick, so turning the backlight down at midnight
//   sticks instead of being shoved back up five minutes later.
//
// STATE
//   ~/.kbdlight-sun.json   coordinates, levels, the snapshot to undo to, and
//                          the last phase applied
//   ~/Library/LaunchAgents/local.kbdlight.sun.plist

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const kbd = require('./index.js');
const geo = require('./geo.js');
const solar = require('./solar.js');

const STATE =
  process.env.KBDLIGHT_SUN_STATE || path.join(os.homedir(), '.kbdlight-sun.json');
const LABEL = 'local.kbdlight.sun';
const PLIST = path.join(os.homedir(), 'Library', 'LaunchAgents', LABEL + '.plist');
const DOMAIN = 'gui/' + process.getuid();
const CLI = path.join(__dirname, '..', 'bin', 'kbdlight.js');

// Five minutes: fine enough that the switch lands within a rounding error of
// sunset, coarse enough that the wakeups are free.
const TICK_SECONDS = 300;

const DEFAULTS = { night: 0.6, day: 0, wake: 1, riseOffset: 0, setOffset: 0 };

// --- state ----------------------------------------------------------------

function read() {
  try {
    return JSON.parse(fs.readFileSync(STATE, 'utf8'));
  } catch (e) {
    return null;
  }
}

function write(state) {
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2) + '\n');
  return state;
}

function forget() {
  try {
    fs.unlinkSync(STATE);
  } catch (e) {
    /* already gone */
  }
}

// Keyboard IDs are uint64: koffi returns a Number inside the safe-integer range
// and a BigInt above it, and JSON.stringify throws on BigInt. Strings survive
// the round trip, and kbd.set/get run their argument through BigInt anyway.
function snapshot() {
  return kbd.keyboardIDs().map((id) => ({
    id: String(id),
    level: kbd.get(id),
    auto: kbd.isAuto(id),
  }));
}

// A level is a number, or the word "auto" to hand that phase back to the
// ambient light sensor. "auto" is worth having for the day phase: in a bright
// room the sensor already does the right thing, and this way sun mode does not
// have to pretend to know how bright the room is.
function parseLevel(input, what) {
  const s = String(input).trim().toLowerCase();
  if (s === 'auto') return 'auto';
  const v = Number(s);
  if (!Number.isFinite(v) || v < 0 || v > 1) {
    throw new Error(what + ' must be 0.0-1.0 or "auto", got "' + input + '"');
  }
  return v;
}

function parseOffset(input, what) {
  const v = Number(String(input).trim());
  if (!Number.isFinite(v) || Math.abs(v) > 720) {
    throw new Error(what + ' must be a number of minutes within +/-720, got "' + input + '"');
  }
  return v;
}

// --- the decision ---------------------------------------------------------

// The next sunrise strictly after `now`, offset included, or null where none is
// coming. Today's sunrise is already behind us for most of the hours anyone
// arms this in, so the search walks forward a day at a time.
//
// The `> now` check applies to every candidate, not only today's. A sunrise
// pulled back far enough by --rise-offset lands in the past, and a wake instant
// in the past fires the moment it is armed: the command that was asked for dark
// would go to full brightness and disarm itself in the same breath.
const SUNRISE_SEARCH_DAYS = 3;
const DAY_MS = 86400000;

function nextSunrise(now, cfg) {
  const shift = (d) => new Date(d.getTime() + (cfg.riseOffset || 0) * 60000);

  for (let i = 0; i <= SUNRISE_SEARCH_DAYS; i++) {
    const day = solar.timesFor(new Date(now.getTime() + i * DAY_MS), cfg.lat, cfg.lon);
    if (day.polar) continue;
    const rise = shift(day.sunrise);
    if (rise > now) return rise;
  }

  return null;
}

// One-shot mode: dark from the moment it is armed until one named instant, then
// a single write and the schedule takes itself out.
//
// It deliberately does NOT ask which side of the sun we are on. "Until sunrise"
// arms at 02:00 and at 14:00 with the same meaning, and a phase machine would
// answer "it is day, so wake up" to the second one and undo the request in the
// same breath.
function oncePlan(now, cfg) {
  const wakeAt = new Date(cfg.wakeAt);
  const woke = now >= wakeAt;
  const today = solar.timesFor(now, cfg.lat, cfg.lon);

  return {
    phase: woke ? 'wake' : 'sleep',
    level: woke ? cfg.wake : cfg.night,
    sunrise: today.sunrise,
    sunset: today.sunset,
    next: woke ? null : wakeAt,
    polar: today.polar,
    once: true,
    wakeAt,
  };
}

// Pure: given an instant and a config, say which phase we are in, what level
// that phase wants, and when it changes next. No hardware, no files, so the
// interesting part is testable without a keyboard or a particular date.
function plan(now, cfg) {
  if (cfg.once) return oncePlan(now, cfg);

  const lat = cfg.lat;
  const lon = cfg.lon;
  const riseOffset = cfg.riseOffset || 0;
  const setOffset = cfg.setOffset || 0;
  const shift = (d, minutes) => (d ? new Date(d.getTime() + minutes * 60000) : null);

  const today = solar.timesFor(now, lat, lon);
  const levelFor = (phase) => {
    const v = phase === 'day' ? cfg.day : cfg.night;
    return v == null ? DEFAULTS[phase] : v;
  };

  // Above the polar circles there is no sunrise to be on either side of, so the
  // sun itself decides the phase and there is no next transition to name.
  if (today.polar) {
    const phase = today.polar === 'day' ? 'day' : 'night';
    return {
      phase,
      level: levelFor(phase),
      sunrise: null,
      sunset: null,
      next: null,
      polar: today.polar,
    };
  }

  const sunrise = shift(today.sunrise, riseOffset);
  const sunset = shift(today.sunset, setOffset);
  const isDay = now >= sunrise && now < sunset;
  const phase = isDay ? 'day' : 'night';

  let next;
  if (isDay) next = sunset;
  else if (now < sunrise) next = sunrise;
  else {
    const tomorrow = solar.timesForNextDay(now, lat, lon);
    next = tomorrow.polar ? null : shift(tomorrow.sunrise, riseOffset);
  }

  return { phase, level: levelFor(phase), sunrise, sunset, next, polar: null };
}

// --- hardware -------------------------------------------------------------

function writeLevel(level, keyboards) {
  const ids = keyboards ? keyboards.map((k) => k.id) : kbd.keyboardIDs();
  for (const id of ids) {
    if (level === 'auto') {
      kbd.setAuto(true, id);
      continue;
    }
    // Order matters: the sensor overrides a fixed level within seconds, so it
    // goes off before the level goes on, never after.
    kbd.setAuto(false, id);
    kbd.set(level, id);
  }
}

// --- launchd --------------------------------------------------------------

const xml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// An nvm path is pinned to one Node version and evaporates on the next nvm
// cleanup, leaving a scheduled job that cannot run. Prefer a stable interpreter
// when the machine has one.
function nodeForLaunchd() {
  if (!process.execPath.includes('/.nvm/')) return process.execPath;
  for (const p of ['/opt/homebrew/bin/node', '/usr/local/bin/node']) {
    if (fs.existsSync(p)) return p;
  }
  return process.execPath;
}

function writePlist() {
  const args = [nodeForLaunchd(), CLI, 'sun', 'apply'];
  const plist =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" ' +
    '"http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n' +
    '<plist version="1.0">\n<dict>\n' +
    '  <key>Label</key>\n  <string>' +
    LABEL +
    '</string>\n' +
    '  <key>ProgramArguments</key>\n  <array>\n' +
    args.map((a) => '    <string>' + xml(a) + '</string>\n').join('') +
    '  </array>\n' +
    // RunAtLoad covers login and the moment the agent is installed; StartInterval
    // covers everything after that, including the tick the Mac slept through.
    '  <key>RunAtLoad</key>\n  <true/>\n' +
    '  <key>StartInterval</key>\n  <integer>' +
    TICK_SECONDS +
    '</integer>\n' +
    '</dict>\n</plist>\n';
  fs.mkdirSync(path.dirname(PLIST), { recursive: true });
  fs.writeFileSync(PLIST, plist);
}

const launchctl = (...args) => spawnSync('launchctl', args, { encoding: 'utf8' });

const agentLoaded = () => launchctl('print', DOMAIN + '/' + LABEL).status === 0;

function loadAgent() {
  launchctl('bootout', DOMAIN + '/' + LABEL); // ignore: usually not loaded yet
  const out = launchctl('bootstrap', DOMAIN, PLIST);
  if (out.status !== 0) {
    throw new Error('launchctl bootstrap failed: ' + (out.stderr || out.stdout || '').trim());
  }
  // A plist that parses is not the same as a job that is loaded, and the whole
  // feature is the schedule, so this is checked rather than assumed.
  if (!agentLoaded()) throw new Error('agent did not load, so nothing would ever switch');
}

function unloadAgent() {
  // File first, then unload: launchd is not killing this process here, but the
  // same ordering keeps a stale plist from being loaded again at next login.
  try {
    fs.unlinkSync(PLIST);
  } catch (e) {
    /* already gone */
  }
  launchctl('bootout', DOMAIN + '/' + LABEL);
}

// --- commands -------------------------------------------------------------

// Pure: everything about arming except reading the disk and touching the
// keyboard. Split out so the rules below can be tested on a CI box with no
// backlit keyboard, which is where a wrong one would otherwise ship from.
function buildConfig(prev, opts, where, saved, now) {
  // The flag name is carried along only so a bad value names the flag the user
  // actually typed rather than the property it happens to be stored under.
  const FLAG = { night: '--night', day: '--day', riseOffset: '--rise-offset', setOffset: '--set-offset' };

  // A one-shot's levels are an instruction for that one night, not a preference
  // to remember. Inheriting them would let "kbdlight sleep" quietly hand its
  // forced night level of 0 to the next plain "kbdlight sun on", which would
  // then never light the keyboard again and never say why.
  const inherit = prev && !prev.once ? prev : null;

  const pick = (name, parse) => {
    if (opts[name] != null) return parse(opts[name], FLAG[name]);
    if (inherit && inherit[name] != null) return inherit[name];
    return DEFAULTS[name];
  };

  const cfg = {
    enabled: true,
    lat: where.lat,
    lon: where.lon,
    source: where.source,
    night: pick('night', parseLevel),
    day: pick('day', parseLevel),
    riseOffset: pick('riseOffset', parseOffset),
    setOffset: pick('setOffset', parseOffset),
    saved,
    phase: null, // unknown, so the first apply always writes
    appliedAt: null,
    error: null,
  };

  // One-shot mode pins the instant now, at arming time, rather than recomputing
  // "the next sunrise" on every tick: five minutes after the switch, the next
  // sunrise is the one a day later, and a job that keeps moving its own finish
  // line never finishes.
  if (opts.once) {
    cfg.once = true;
    cfg.wake = opts.wake != null ? parseLevel(opts.wake, '--wake') : DEFAULTS.wake;
    const wakeAt = nextSunrise(now, cfg);
    if (!wakeAt) {
      // Naming the wrong polar case would send the user to the opposite remedy,
      // so the message is taken from what the sky is actually doing today.
      const polar = solar.timesFor(now, cfg.lat, cfg.lon).polar;
      const because =
        polar === 'day'
          ? 'the sun does not set there at this time of year'
          : 'the sun does not rise there at this time of year';
      throw new Error(
        'no sunrise within ' +
          SUNRISE_SEARCH_DAYS +
          ' days at ' +
          cfg.lat.toFixed(2) +
          ', ' +
          cfg.lon.toFixed(2) +
          ': ' +
          because +
          '. Use "kbdlight sun on" for a fixed level instead'
      );
    }
    cfg.wakeAt = wakeAt.toISOString();
  }

  return cfg;
}

// Arm it. Re-running with new options keeps the original snapshot, so `sun off`
// still undoes to the state from before sun mode ever touched anything.
function enable(opts = {}) {
  const prev = read();

  let where;
  if (opts.at) where = geo.parseCoords(opts.at);
  else if (prev && prev.lat != null) where = { lat: prev.lat, lon: prev.lon, source: prev.source };
  else where = geo.locate();

  const saved = prev && prev.saved && prev.saved.length ? prev.saved : snapshot();
  if (!saved.length) throw new Error('no backlit keyboard found');

  const cfg = buildConfig(prev, opts, where, saved, new Date());

  write(cfg);
  writePlist();
  loadAgent();

  return { config: cfg, rearmed: !!prev, applied: apply({ force: true }) };
}

// "Dark now, back up at sunrise, then forget about it." The whole feature is
// one call into enable(), because sharing sun mode's state file and its single
// launchd agent is what keeps two schedules from writing the same keyboard in
// the same tick and leaving whichever lost the race.
function sleepUntilSunrise(opts = {}) {
  const r = enable(Object.assign({ night: 0 }, opts, { once: true }));

  // Holding a level means turning the ambient sensor off, and a fixed wake level
  // means it stays off afterwards: this mode ends in a state, it does not hand
  // the keyboard back. That is a thing the caller has to be able to say out
  // loud, because the alternative is a sensor that silently stopped working
  // overnight.
  const sensorWasOn = r.config.saved.some((k) => k.auto);

  return {
    config: r.config,
    wakeAt: new Date(r.config.wakeAt),
    rearmed: r.rearmed,
    sensorStaysOff: sensorWasOn && r.config.wake !== 'auto',
  };
}

// Disarm, and put the keyboard back the way sun mode found it. "Dark until
// sunrise" that cannot be undone is just "dark", and you notice at noon.
function disable() {
  const cfg = read();
  unloadAgent();

  if (!cfg) {
    forget();
    return { wasOn: false, restored: null };
  }

  let restored = null;
  if (cfg.saved && cfg.saved.length) {
    for (const k of cfg.saved) {
      kbd.set(k.level, k.id);
      kbd.setAuto(k.auto, k.id); // auto last: it takes the level back over
    }
    restored = cfg.saved.map((k) => k.level);
  }

  forget();
  return { wasOn: true, restored };
}

// What the launchd agent runs. Idempotent by design: it compares the phase it
// computes against the phase it last wrote, and does nothing the rest of the
// time.
function apply(opts = {}) {
  const cfg = read();
  if (!cfg || !cfg.enabled) return { ran: false, reason: 'sun mode is off' };

  const now = opts.now || new Date();
  const p = plan(now, cfg);

  if (!opts.force && p.phase === cfg.phase) {
    return { ran: false, reason: 'already ' + p.phase, plan: p };
  }

  try {
    writeLevel(p.level, cfg.saved);
  } catch (e) {
    // The agent has no terminal to complain to, so the failure is recorded
    // where `kbdlight sun` will show it instead of vanishing every five minutes.
    write(Object.assign({}, cfg, { error: e.message, errorAt: now.toISOString() }));
    throw e;
  }

  // The one-shot is done the moment it has written the waking level. It removes
  // its own agent and state rather than idling until the user remembers it: a
  // schedule nobody asked for any more is the thing that surprises you at
  // sunset, when it would otherwise go dark again.
  //
  // State first, agent second, and not the other way round: booting out this
  // job kills the process running these lines, so anything left for "after"
  // may never happen. A leftover state file would then read as armed forever.
  if (cfg.once && p.phase === 'wake') {
    forget();
    unloadAgent();
    return { ran: true, done: true, plan: p };
  }

  write(
    Object.assign({}, cfg, {
      phase: p.phase,
      appliedAt: now.toISOString(),
      error: null,
      errorAt: null,
    })
  );
  return { ran: true, plan: p };
}

function status(now = new Date()) {
  const cfg = read();
  const loaded = agentLoaded();
  if (!cfg || !cfg.enabled) return { on: false, agent: loaded, config: cfg };
  return { on: true, agent: loaded, config: cfg, plan: plan(now, cfg) };
}

module.exports = {
  enable,
  buildConfig,
  sleepUntilSunrise,
  nextSunrise,
  disable,
  apply,
  status,
  plan,
  parseLevel,
  parseOffset,
  read,
  STATE,
  PLIST,
  LABEL,
  TICK_SECONDS,
  DEFAULTS,
};
