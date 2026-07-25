'use strict';

// Smoke test: exercises the real API against the machine's keyboard, restoring
// the original state afterward. Skips cleanly on non-macOS / no-backlight hosts
// so it is safe in CI. Run: npm test
const assert = require('assert');
const os = require('os');
const kbd = require('../src/index.js');

function skip(reason) {
  console.log('SKIP: ' + reason);
  process.exit(0);
}

if (os.platform() !== 'darwin') skip('not macOS');

let ids;
try {
  ids = kbd.keyboardIDs();
} catch (e) {
  skip('CoreBrightness unavailable: ' + e.message);
}
if (!ids.length) skip('no backlit keyboard');

// koffi returns a Number for uint64 in the safe-integer range, BigInt above it.
assert.ok(
  ids.every((n) => typeof n === 'number' || typeof n === 'bigint'),
  'IDs are numeric'
);

// Snapshot original state to restore at the end.
const origLevel = kbd.get();
const origAuto = kbd.isAuto();

try {
  kbd.setAuto(false); // stop the sensor from fighting our writes
  assert.strictEqual(kbd.isAuto(), false, 'auto disabled');

  const set = kbd.set(0.5);
  assert.strictEqual(set, 0.5, 'set returns clamped value');
  assert.ok(Math.abs(kbd.get() - 0.5) < 0.01, 'brightness reads back ~0.5');

  assert.strictEqual(kbd.set(2), 1, 'over-range clamps to 1');
  assert.strictEqual(kbd.set(-1), 0, 'under-range clamps to 0');

  assert.throws(() => kbd.set('nope'), /number/, 'non-numeric level throws');

  pulseChecks();

  console.log('PASS: ' + ids.length + ' keyboard(s)');
} finally {
  kbd.set(origLevel);
  kbd.setAuto(origAuto);
}

// `kbdlight pulse` is fired from hooks and cron jobs, where the only thing that
// matters is that it hands the keyboard back untouched. These run synchronously
// via execFileSync so the assertions see the finished state, not a race.
function pulseChecks() {
  const { execFileSync } = require('child_process');
  const path = require('path');
  const pulse = require('../src/pulse.js');

  const bin = path.join(__dirname, '..', 'bin', 'kbdlight.js');
  const run = (args) =>
    execFileSync(process.execPath, [bin, 'pulse'].concat(args), { encoding: 'utf8' });

  const quick = ['1', '--on', '20', '--off', '20', '--predark', '0'];
  const wasMuted = pulse.mutedUntil(); // never clobber a mute the user set

  try {
    run(['--unmute']);

    kbd.setAuto(false);
    kbd.set(0.5);
    run(quick);
    assert.ok(Math.abs(kbd.get() - 0.5) < 0.01, 'pulse restores the brightness it found');
    assert.strictEqual(kbd.isAuto(), false, 'pulse restores auto-brightness state');

    // A count is positional, but flag values are numbers too. Without a parser
    // that consumes them, "--on 20" reads as twenty blinks.
    assert.match(
      run(['--on', '20', '--off', '20', '--predark', '0', '--status']),
      /not muted/,
      'flag values are not mistaken for the blink count'
    );

    // A muted pulse must not touch the hardware at all.
    run(['--mute-until', '23:59']);
    kbd.set(0.25);
    run(quick);
    assert.ok(Math.abs(kbd.get() - 0.25) < 0.01, 'muted pulse leaves the keyboard alone');
    assert.match(run(['--status']), /muted until/, 'status reports the mute');

    run(['--unmute']);
    assert.match(run(['--status']), /not muted/, 'status reports the mute is gone');

    lockCheck(run);
  } finally {
    // The mute is a real file in the user's home directory, so a failed
    // assertion must not leave their notifier silenced for the rest of the day.
    pulse.unmute();
    if (wasMuted) pulse.muteUntil(wasMuted);
  }
}

// The lock is what stops a second run from snapshotting the keyboard mid-blink
// and "restoring" it to dark, so it gets a test of its own. Driven through the
// CLI rather than blink() directly, to keep this file synchronous: an assertion
// inside a floating promise would report as an unhandled rejection instead of a
// test failure.
function lockCheck(run) {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');

  const lock = path.join(os.tmpdir(), 'kbdlight-pulse.lock');
  if (fs.existsSync(lock)) return; // a real pulse is running, leave it alone

  fs.writeFileSync(lock, String(process.pid));
  try {
    kbd.set(0.75);
    // A blink here would take 1 second of lit time. Returning instantly with
    // the keyboard untouched is the whole assertion.
    run(['1', '--on', '20', '--off', '20', '--predark', '0']);
    assert.ok(Math.abs(kbd.get() - 0.75) < 0.01, 'a locked pulse leaves the keyboard alone');
  } finally {
    fs.unlinkSync(lock);
  }
}
