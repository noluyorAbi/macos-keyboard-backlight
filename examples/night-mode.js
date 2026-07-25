'use strict';

// Night mode: keyboard dark now, guaranteed back on later.
//
// WHAT IT DOES
//   Snapshots the current backlight state, takes the keyboard to zero, mutes
//   the Claude Code pulse notifier, and schedules the exact reverse for a time
//   you name. The restore is the whole point: "dark until 10:00" that has no
//   way back on is just "dark", and you find out at 10:55.
//
// WHY LAUNCHD AND NOT A SLEEPING PROCESS
//   A `setTimeout` for seven hours dies with the terminal, the SSH session, the
//   logout, or the reboot. A launchd agent survives all four, and if the Mac is
//   asleep or off at the scheduled moment, launchd runs the job at the next
//   wake or boot instead of silently skipping it. The agent removes itself
//   after it fires, so nothing lingers and nothing repeats tomorrow.
//
// USAGE
//   node examples/night-mode.js --until 10:00        dark now, restore at 10:00
//   node examples/night-mode.js --until 2026-07-26T09:30
//   node examples/night-mode.js --status             what is armed, if anything
//   node examples/night-mode.js --cancel             restore right now
//   node examples/night-mode.js --restore            what the agent itself runs
//
// STATE
//   ~/.kbdlight-night-mode.json   snapshot plus the target time
//   ~/.kbdlight-pulse-mute        shared with claude-code-pulse.js
//   ~/Library/LaunchAgents/local.kbdlight.night-mode.plist

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const kbd = require('../src/index.js');
const { parseUntil, muteUntil, unmute, mutedUntil } = require('./lib/pulse-mute');

const STATE = path.join(os.homedir(), '.kbdlight-night-mode.json');
const LABEL = 'local.kbdlight.night-mode';
const PLIST = path.join(os.homedir(), 'Library', 'LaunchAgents', LABEL + '.plist');
const DOMAIN = 'gui/' + process.getuid();

// --- state ----------------------------------------------------------------

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE, 'utf8'));
  } catch (e) {
    return null;
  }
}

// Keyboard IDs are uint64: koffi hands back a Number in the safe-integer range
// and a BigInt above it, and JSON.stringify throws on BigInt. Storing them as
// strings sidesteps that, and kbd.set/get accept a string fine because they
// run it through BigInt() anyway.
function snapshot() {
  return kbd.keyboardIDs().map((id) => ({
    id: String(id),
    level: kbd.get(id),
    auto: kbd.isAuto(id),
  }));
}

// --- launchd --------------------------------------------------------------

const xml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The nvm path is pinned to one Node version and evaporates on the next nvm
// cleanup, which would leave a scheduled job that cannot run. Prefer a stable
// interpreter path when one exists.
function nodeForLaunchd() {
  if (!process.execPath.includes('/.nvm/')) return process.execPath;
  for (const p of ['/opt/homebrew/bin/node', '/usr/local/bin/node']) {
    if (fs.existsSync(p)) return p;
  }
  return process.execPath;
}

function writePlist(at) {
  const args = [nodeForLaunchd(), __filename, '--restore'];
  const plist =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" ' +
    '"http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n' +
    '<plist version="1.0">\n<dict>\n' +
    '  <key>Label</key>\n  <string>' + LABEL + '</string>\n' +
    '  <key>ProgramArguments</key>\n  <array>\n' +
    args.map((a) => '    <string>' + xml(a) + '</string>\n').join('') +
    '  </array>\n' +
    '  <key>StartCalendarInterval</key>\n  <dict>\n' +
    '    <key>Hour</key>\n    <integer>' + at.getHours() + '</integer>\n' +
    '    <key>Minute</key>\n    <integer>' + at.getMinutes() + '</integer>\n' +
    '  </dict>\n' +
    '</dict>\n</plist>\n';
  fs.mkdirSync(path.dirname(PLIST), { recursive: true });
  fs.writeFileSync(PLIST, plist);
}

const launchctl = (...args) => spawnSync('launchctl', args, { encoding: 'utf8' });

function loadAgent() {
  launchctl('bootout', DOMAIN + '/' + LABEL); // ignore: usually not loaded yet
  const out = launchctl('bootstrap', DOMAIN, PLIST);
  if (out.status !== 0) {
    throw new Error('launchctl bootstrap failed: ' + (out.stderr || out.stdout || '').trim());
  }
  // Trust nothing: a plist that parses is not the same as a job that is loaded.
  if (launchctl('print', DOMAIN + '/' + LABEL).status !== 0) {
    throw new Error('agent did not load, so the restore would never fire');
  }
}

function unloadAgent() {
  // Delete the file first, then unload. When the agent unloads *itself* after
  // firing, `bootout` kills this very process, so anything after it never runs
  // and the plist would survive to be loaded again at the next login.
  try {
    fs.unlinkSync(PLIST);
  } catch (e) {
    /* already gone */
  }
  launchctl('bootout', DOMAIN + '/' + LABEL);
}

// --- commands -------------------------------------------------------------

function start(untilInput) {
  const at = parseUntil(untilInput);
  const existing = readState();

  // Re-arming while already dark must not snapshot the dark state as the thing
  // to return to. Keep the original snapshot, move only the target time.
  const keyboards = existing ? existing.keyboards : snapshot();
  if (!keyboards.length) throw new Error('no backlit keyboard found');

  fs.writeFileSync(STATE, JSON.stringify({ until: at.toISOString(), keyboards }, null, 2));

  for (const k of keyboards) {
    kbd.setAuto(false, k.id); // the ambient sensor would undo this within seconds
    kbd.set(0, k.id);
  }

  muteUntil(at); // a notifier that flashes a dark room is a notifier you uninstall
  writePlist(at);
  loadAgent();

  console.log('keyboard dark, pulse notifier muted');
  console.log('restore armed for ' + at.toLocaleString() + ' (' + LABEL + ')');
  if (existing) console.log('kept the original snapshot from the earlier run');
}

// `force` is what separates "the agent woke up" from "the user said stop now":
// only the scheduled path may decide it is too early and go back to sleep.
function restore(reason, force) {
  const state = readState();

  if (!force && state && new Date(state.until) - Date.now() > 60000) {
    // The job fires at a clock time, so for a target further out than today it
    // fires early. Leave everything armed and let the next firing do the work.
    console.log('not yet: night mode runs until ' + new Date(state.until).toLocaleString());
    return;
  }

  if (state) {
    for (const k of state.keyboards) {
      kbd.set(k.level, k.id);
      kbd.setAuto(k.auto, k.id); // auto last, it takes the level back over
    }
    console.log(
      reason + ': restored ' + state.keyboards.map((k) => k.level).join(', ')
    );
  } else {
    console.log(reason + ': no saved state, nothing to restore');
  }

  try {
    fs.unlinkSync(STATE);
  } catch (e) {
    /* already gone */
  }
  unmute();
  unloadAgent();
}

function status() {
  const state = readState();
  const mute = mutedUntil();
  const loaded = launchctl('print', DOMAIN + '/' + LABEL).status === 0;

  if (!state && !mute && !loaded) {
    console.log('night mode: off');
    return;
  }
  console.log('night mode: on');
  if (state) {
    console.log('  restore at   ' + new Date(state.until).toLocaleString());
    console.log('  saved levels ' + state.keyboards.map((k) => k.level).join(', '));
  }
  console.log('  pulse mute   ' + (mute ? 'until ' + mute.toLocaleString() : 'off'));
  console.log('  launchd job  ' + (loaded ? 'loaded' : 'MISSING, restore will not fire'));
}

// --- cli ------------------------------------------------------------------

const untilArg = process.argv.indexOf('--until');

try {
  if (untilArg !== -1) start(process.argv[untilArg + 1] || '');
  else if (process.argv.includes('--restore')) restore('scheduled restore', false);
  else if (process.argv.includes('--cancel')) restore('cancelled', true);
  else if (process.argv.includes('--status')) status();
  else {
    console.log('usage:');
    console.log('  node night-mode.js --until 10:00   dark now, restore at 10:00');
    console.log('  node night-mode.js --status');
    console.log('  node night-mode.js --cancel        restore right now');
  }
} catch (e) {
  console.error('night-mode: ' + e.message);
  process.exitCode = 1;
}
