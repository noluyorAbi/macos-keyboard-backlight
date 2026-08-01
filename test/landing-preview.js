'use strict';

// The landing page carries its own copy of the solar algorithm, because the
// browser cannot require src/solar.js and the page is not allowed to fetch
// anything. A second copy of an algorithm is a promise to keep it in step, and
// this file is what keeps it: it runs landing/sun-preview.js with no DOM and
// compares its sunrise and sunset against src/solar.js across a full year, at
// latitudes from the equator to inside the arctic circle.
//
// It also checks the generated timezone table still matches src/geo.js, so a
// city corrected in the package cannot leave the page drawing the old one.
//
// Run: node test/landing-preview.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const solar = require('../src/solar.js');
const geo = require('../src/geo.js');

const LANDING = path.join(__dirname, '..', 'landing');

// --- the page's copy of the algorithm --------------------------------------

// A window and a document that do just enough for the file to load: it looks
// for its data and its root element, finds no root, and stops before painting.
const sandbox = { window: { setInterval() {} }, document: { querySelector: () => null } };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);

// Same order the page loads them in: the table first, because sun-preview.js
// reads it once at load and closes over the result.
for (const file of ['sun-data.js', 'sun-preview.js']) {
  vm.runInContext(fs.readFileSync(path.join(LANDING, file), 'utf8'), sandbox, { filename: file });
}

const page = sandbox.window.__kbdlightSunPreview;
assert.ok(page && page.timesFor, 'sun-preview.js exposes its solar functions for this test');

// --- it agrees with the package --------------------------------------------

const PLACES = [
  { name: 'Berlin', lat: 52.52, lon: 13.41 },
  { name: 'Munich', lat: 48.14, lon: 11.58 },
  { name: 'the equator', lat: 0, lon: 0 },
  { name: 'Sydney', lat: -33.87, lon: 151.21 },
  { name: 'Reykjavik', lat: 64.15, lon: -21.94 },
  { name: 'Singapore', lat: 1.35, lon: 103.82 },
  // Reykjavik is famously bright in June and still sits below the arctic
  // circle, so it never gives a day without a sunrise. Longyearbyen does, and
  // the polar branch is the one most likely to be copied wrongly.
  { name: 'Longyearbyen', lat: 78.22, lon: 15.65 },
];

let compared = 0;
let polarDays = 0;

for (const place of PLACES) {
  // Every third day of a leap year: enough to cross both solstices, both
  // equinoxes, and the days either side of them.
  for (let dayOfYear = 0; dayOfYear < 366; dayOfYear += 3) {
    const when = new Date(2028, 0, 1 + dayOfYear, 12, 0, 0);

    const mine = solar.timesFor(when, place.lat, place.lon);
    const theirs = page.timesFor(when, place.lat, place.lon);

    assert.strictEqual(
      theirs.polar,
      mine.polar,
      `${place.name} on ${when.toDateString()}: the page and the package disagree about polar day`
    );

    if (mine.polar) {
      polarDays += 1;
      assert.strictEqual(theirs.sunrise, null, 'a polar day reports no sunrise on the page too');
      continue;
    }

    for (const key of ['sunrise', 'sunset', 'solarNoon']) {
      const drift = Math.abs(theirs[key] - mine[key]);
      assert.ok(
        drift < 1000,
        `${place.name} on ${when.toDateString()}: ${key} drifted ${Math.round(drift / 1000)} s ` +
          `between src/solar.js (${mine[key].toISOString()}) and the page (${theirs[key].toISOString()})`
      );
    }
    compared += 1;
  }
}

assert.ok(compared > 600, 'the comparison actually ran, got ' + compared + ' days');
assert.ok(polarDays > 0, 'Longyearbyen contributes days with no sunrise and no sunset');

// --- the generated table is the package's table ----------------------------

// sun-data.js is written by landing/sync.mjs. Reading what the script actually
// defined, rather than parsing the file, is what proves the browser gets this.
const shipped = sandbox.window.__kbdlightSunData;
assert.ok(shipped, 'sun-data.js defines the table');

// Objects built inside a vm context carry that context's prototypes, and
// deepStrictEqual compares those too. Round-tripping through JSON brings the
// values back into this realm so the comparison is about the data.
const plain = (value) => JSON.parse(JSON.stringify(value));

assert.deepStrictEqual(
  plain(shipped.zones),
  geo.TZ_COORDS,
  'landing/sun-data.js is stale; run: node landing/sync.mjs'
);
assert.deepStrictEqual(
  plain(shipped.aliases),
  geo.TZ_ALIASES,
  'landing/sun-data.js aliases are stale; run: node landing/sync.mjs'
);

// The visitor's own timezone has to resolve through the shipped table, or the
// preview silently stays an example on the machine that ships it.
const here = page.locate();
assert.ok(
  here && Number.isFinite(here.lat) && Number.isFinite(here.lon),
  'this machine\'s timezone resolves through the shipped table'
);

console.log(
  'PASS: ' + compared + ' days across ' + PLACES.length + ' places, ' +
    Object.keys(shipped.zones).length + ' zones in step'
);
