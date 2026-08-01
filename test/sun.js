'use strict';

// Tests for the parts that have no hardware in them: the solar math, the
// day/night decision, coordinate parsing, and how the CLI decides to colour.
//
// These run everywhere, including a CI box with no backlit keyboard, which is
// the point: the sunrise a schedule fires on is the one thing here that cannot
// be checked by looking at the machine afterwards.
//
// Run: node test/sun.js

const assert = require('assert');
const path = require('path');
const { execFileSync } = require('child_process');

// Before requiring sun.js: it resolves its state file at load time, and a test
// must never read or write the real one in the user's home directory.
process.env.KBDLIGHT_SUN_STATE = path.join(
  require('os').tmpdir(),
  'kbdlight-sun-test-' + process.pid + '.json'
);

const solar = require('../src/solar.js');
const geo = require('../src/geo.js');
const sun = require('../src/sun.js');
const color = require('../src/color.js');

const BIN = path.join(__dirname, '..', 'bin', 'kbdlight.js');
const BERLIN = { lat: 52.52, lon: 13.41 };
const utcMinutes = (d) => d.getUTCHours() * 60 + d.getUTCMinutes();
const hours = (a, b) => (b - a) / 3600000;

// --- solar ----------------------------------------------------------------
// Checked against NOAA's published times for Berlin. Asserted in UTC so the
// result does not depend on the timezone the test host is set to.

{
  const midsummer = solar.timesFor(new Date('2026-06-21T12:00:00Z'), BERLIN.lat, BERLIN.lon);
  assert.ok(
    Math.abs(utcMinutes(midsummer.sunrise) - (2 * 60 + 43)) <= 3,
    'Berlin midsummer sunrise is 02:43 UTC, got ' + midsummer.sunrise.toISOString()
  );
  assert.ok(
    Math.abs(utcMinutes(midsummer.sunset) - (19 * 60 + 33)) <= 3,
    'Berlin midsummer sunset is 19:33 UTC, got ' + midsummer.sunset.toISOString()
  );
  assert.ok(
    midsummer.sunrise < midsummer.solarNoon && midsummer.solarNoon < midsummer.sunset,
    'solar noon falls between sunrise and sunset'
  );

  const midwinter = solar.timesFor(new Date('2026-12-21T12:00:00Z'), BERLIN.lat, BERLIN.lon);
  assert.ok(
    Math.abs(utcMinutes(midwinter.sunrise) - (7 * 60 + 14)) <= 3,
    'Berlin midwinter sunrise is 07:14 UTC, got ' + midwinter.sunrise.toISOString()
  );

  // The seasons are the whole reason this is computed rather than configured.
  assert.ok(hours(midsummer.sunrise, midsummer.sunset) > 16.5, 'Berlin has a long midsummer day');
  assert.ok(hours(midwinter.sunrise, midwinter.sunset) < 8.5, 'Berlin has a short midwinter day');

  // Southern hemisphere: the same date is the other solstice.
  const sydney = solar.timesFor(new Date('2026-06-21T12:00:00Z'), -33.87, 151.21);
  assert.ok(hours(sydney.sunrise, sydney.sunset) < 10.5, 'Sydney is in winter on 21 June');

  // Refraction and the radius of the solar disc put the equinox a little over
  // twelve hours, which is the check that the 90.833 zenith is being used.
  const equator = solar.timesFor(new Date('2026-03-20T12:00:00Z'), 0, 0);
  const len = hours(equator.sunrise, equator.sunset);
  assert.ok(len > 12 && len < 12.3, 'equinox on the equator is just over 12 h, got ' + len);
}

{
  // Above the polar circle the sun can fail to cross the horizon at all. Null
  // times with a stated reason beat a NaN that propagates into a schedule.
  const summer = solar.timesFor(new Date('2026-06-21T12:00:00Z'), 78.22, 15.65);
  assert.strictEqual(summer.polar, 'day', 'Svalbard has midnight sun in June');
  assert.strictEqual(summer.sunrise, null, 'no sunrise to report during midnight sun');

  const winter = solar.timesFor(new Date('2026-12-21T12:00:00Z'), 78.22, 15.65);
  assert.strictEqual(winter.polar, 'night', 'Svalbard has polar night in December');

  assert.throws(() => solar.timesFor(new Date(), 95, 0), /latitude/, 'latitude is validated');
  assert.throws(() => solar.timesFor(new Date(), 0, 200), /longitude/, 'longitude is validated');
}

// --- the day/night decision -----------------------------------------------

{
  const cfg = { lat: BERLIN.lat, lon: BERLIN.lon, night: 0.6, day: 0 };
  const at = (iso) => sun.plan(new Date(iso), cfg);

  assert.strictEqual(at('2026-08-01T12:00:00Z').phase, 'day', 'midday is day');
  assert.strictEqual(at('2026-08-01T12:00:00Z').level, 0, 'day means the backlight is off');
  assert.strictEqual(at('2026-08-01T03:00:00Z').phase, 'night', 'before sunrise is night');
  assert.strictEqual(at('2026-08-01T21:00:00Z').phase, 'night', 'after sunset is night');
  assert.strictEqual(at('2026-08-01T21:00:00Z').level, 0.6, 'night means the chosen level');

  const midday = at('2026-08-01T12:00:00Z');
  assert.deepStrictEqual(midday.next, midday.sunset, 'the next switch during the day is sunset');
  const evening = at('2026-08-01T21:00:00Z');
  assert.ok(
    evening.next > new Date('2026-08-01T21:00:00Z'),
    'after sunset the next switch is tomorrow morning, not today'
  );

  // An offset has to actually move the boundary, or "--rise-offset 60" would be
  // a flag that silently does nothing.
  const shifted = { ...cfg, riseOffset: 60 };
  assert.strictEqual(
    sun.plan(new Date('2026-08-01T04:00:00Z'), cfg).phase,
    'day',
    'without an offset, 04:00 UTC is after Berlin sunrise'
  );
  assert.strictEqual(
    sun.plan(new Date('2026-08-01T04:00:00Z'), shifted).phase,
    'night',
    'a +60 min sunrise offset holds the night an hour longer'
  );

  // Polar latitudes still have to produce a phase and a level, because the
  // agent runs there too.
  const polar = sun.plan(new Date('2026-06-21T12:00:00Z'), { ...cfg, lat: 78.22, lon: 15.65 });
  assert.strictEqual(polar.phase, 'day', 'midnight sun is treated as day');
  assert.strictEqual(polar.next, null, 'there is no next switch under the midnight sun');

  // "auto" hands a phase back to the ambient sensor instead of a fixed level.
  const sensorByDay = sun.plan(new Date('2026-08-01T12:00:00Z'), { ...cfg, day: 'auto' });
  assert.strictEqual(sensorByDay.level, 'auto', '--day auto survives into the plan');

  assert.strictEqual(sun.parseLevel('auto'), 'auto', 'parseLevel accepts auto');
  assert.strictEqual(sun.parseLevel('0.5'), 0.5, 'parseLevel accepts a number');
  assert.throws(() => sun.parseLevel('2', '--night'), /--night/, 'an out-of-range level names the flag');
  assert.throws(() => sun.parseOffset('9000', '--set-offset'), /--set-offset/, 'a silly offset is refused');
}

// --- coordinates ----------------------------------------------------------

{
  assert.deepStrictEqual(geo.parseCoords('48.14,11.58'), { lat: 48.14, lon: 11.58, source: 'manual' });
  assert.deepStrictEqual(geo.parseCoords(' 48.14 11.58 '), { lat: 48.14, lon: 11.58, source: 'manual' });
  assert.throws(() => geo.parseCoords('48.14'), /coordinates look like/, 'one number is not a location');
  assert.throws(() => geo.parseCoords('91,0'), /latitude/, 'latitude is range checked');
  assert.throws(() => geo.parseCoords('0,181'), /longitude/, 'longitude is range checked');
  assert.throws(() => geo.parseCoords('north,west'), /latitude/, 'words are not coordinates');

  assert.deepStrictEqual(geo.coordsForTimezone('Europe/Berlin'), { lat: 52.52, lon: 13.41 });
  assert.deepStrictEqual(
    geo.coordsForTimezone('Asia/Calcutta'),
    geo.coordsForTimezone('Asia/Kolkata'),
    'historic zone names resolve to the same place'
  );
  assert.strictEqual(geo.coordsForTimezone('Mars/Olympus_Mons'), null, 'unknown zones return null');
}

// --- colour ---------------------------------------------------------------

{
  const env = { ...process.env };
  const reset = () => {
    for (const k of ['NO_COLOR', 'FORCE_COLOR', 'CLICOLOR_FORCE', 'TERM']) delete process.env[k];
  };
  const tty = { isTTY: true };
  const pipe = { isTTY: false };

  try {
    reset();
    assert.strictEqual(color.wantsColor(tty, []), true, 'a terminal gets colour');
    assert.strictEqual(color.wantsColor(pipe, []), false, 'a pipe does not');

    process.env.NO_COLOR = '1';
    assert.strictEqual(color.wantsColor(tty, []), false, 'NO_COLOR wins over a terminal');
    assert.strictEqual(color.wantsColor(tty, ['--color']), true, 'an explicit --color wins over NO_COLOR');
    reset();

    process.env.FORCE_COLOR = '1';
    assert.strictEqual(color.wantsColor(pipe, []), true, 'FORCE_COLOR colours a pipe');
    process.env.FORCE_COLOR = '0';
    assert.strictEqual(color.wantsColor(tty, []), false, 'FORCE_COLOR=0 means off');
    reset();

    process.env.TERM = 'dumb';
    assert.strictEqual(color.wantsColor(tty, []), false, 'a dumb terminal gets no escapes');
    reset();

    assert.strictEqual(color.wantsColor(tty, ['--no-color']), false, '--no-color is honoured');
  } finally {
    process.env = env;
  }

  // Padding is computed from printable width, which is the only reason the help
  // columns stay aligned once the words carry escape codes.
  const c = color.colors(tty, ['--color']);
  assert.strictEqual(color.width(c.cmd('set')), 3, 'escape codes do not count towards width');
  assert.strictEqual(color.strip(c.cmd(c.arg('set'))), 'set', 'nested styles strip back to the text');
}

// --- the CLI's help -------------------------------------------------------

{
  const run = (args, env) =>
    execFileSync(process.execPath, [BIN].concat(args), {
      encoding: 'utf8',
      env: { ...process.env, ...env },
    });

  const plain = run(['--help'], { NO_COLOR: '1', FORCE_COLOR: '' });
  assert.ok(!plain.includes('\u001b['), 'NO_COLOR help carries no escape codes');
  for (const expected of ['kbdlight sun on', '--night', '--rise-offset', 'kbdlight pulse']) {
    assert.ok(plain.includes(expected), 'help documents ' + expected);
  }

  // Column alignment is what colour is most likely to break, because padding
  // measured on the raw string counts escape codes as visible characters.
  const painted = run(['--help'], { FORCE_COLOR: '1', NO_COLOR: '' });
  assert.ok(painted.includes('\u001b['), 'FORCE_COLOR help is coloured');
  assert.strictEqual(color.strip(painted), plain, 'colour changes nothing but the escape codes');

  const described = plain.split('\n').filter((l) => /^ {2}(kbdlight|--\w)/.test(l));
  assert.ok(described.length > 20, 'the help still has rows to check');
  for (const line of described) {
    assert.ok(
      line[30] === ' ' && line[31] !== ' ',
      'every description starts in the same column: ' + JSON.stringify(line)
    );
  }

  assert.throws(
    () => execFileSync(process.execPath, [BIN, 'sun', 'sideways'], { stdio: 'pipe' }),
    /unknown sub-command/,
    'a bad sun sub-command fails loudly'
  );
}

console.log('PASS: solar, plan, coordinates, colour, help');
