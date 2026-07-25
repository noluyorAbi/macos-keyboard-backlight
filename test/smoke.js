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

  const wasMuted = pulse.mutedUntil(); // never clobber a mute the user set
  run(['--unmute']);

  kbd.setAuto(false);
  kbd.set(0.5);
  run(['1', '--on', '20', '--off', '20', '--predark', '0']);
  assert.ok(Math.abs(kbd.get() - 0.5) < 0.01, 'pulse restores the brightness it found');
  assert.strictEqual(kbd.isAuto(), false, 'pulse restores auto-brightness state');

  // A muted pulse must not touch the hardware at all.
  run(['--mute-until', '23:59']);
  kbd.set(0.25);
  run(['1', '--on', '20', '--off', '20', '--predark', '0']);
  assert.ok(Math.abs(kbd.get() - 0.25) < 0.01, 'muted pulse leaves the keyboard alone');
  assert.match(run(['--status']), /muted until/, 'status reports the mute');

  run(['--unmute']);
  assert.match(run(['--status']), /not muted/, 'status reports the mute is gone');
  if (wasMuted) pulse.muteUntil(wasMuted);
}
