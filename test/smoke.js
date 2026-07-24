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

  console.log('PASS: ' + ids.length + ' keyboard(s)');
} finally {
  kbd.set(origLevel);
  kbd.setAuto(origAuto);
}
