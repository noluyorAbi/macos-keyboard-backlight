#!/usr/bin/env node
/**
 * Regression test for the generator.
 *
 * `sync.mjs --check` is documented as the staleness gate, and it is only worth
 * anything if the generator is a pure function of content.json. It was not:
 * sitemap.xml stamped `lastmod` with `new Date()`, so the check reported the
 * tree stale on every day after the last sync and a real drift was
 * indistinguishable from the date rolling over.
 *
 * This asserts the property that fix established, so nobody reintroduces a
 * clock, a random value or an environment read into the generated output.
 *
 * Run: node test-sync.mjs
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const DIR = dirname(fileURLToPath(import.meta.url));
const OUTPUTS = ["index.html", "robots.txt", "sitemap.xml"];
const CONTENT = join(DIR, "content.json");

const read = (name) => readFileSync(join(DIR, name), "utf8");
const sync = (args = []) =>
  execFileSync("node", [join(DIR, "sync.mjs"), ...args], {
    cwd: DIR,
    encoding: "utf8",
  });

let failures = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (e) {
    failures++;
    console.error(`FAIL ${name}\n     ${e.message.split("\n")[0]}`);
  }
};

// The committed output must already match content.json, or every other
// assertion below is measuring the wrong thing.
check("committed output is in sync", () => {
  sync(["--check"]);
});

check("two runs produce byte-identical output", () => {
  sync();
  const first = OUTPUTS.map(read);
  sync();
  const second = OUTPUTS.map(read);
  OUTPUTS.forEach((name, i) => {
    assert.equal(second[i], first[i], `${name} changed between two runs`);
  });
});

check("no generated file reads the clock", () => {
  // Pin site.lastmod to a date that is definitely not today, regenerate, and
  // assert the output carries the configured date and never the current one.
  //
  // Comparing two back to back runs is not enough on its own: both would read
  // the same wall clock within the same second and agree. This is the check
  // that would actually have failed before the fix, on any day.
  const original = read("content.json");
  const today = new Date().toISOString().slice(0, 10);
  const pinned = "2001-09-09";
  assert.notEqual(pinned, today, "pick a different pinned date");

  try {
    const doc = JSON.parse(original);
    doc.site.lastmod = pinned;
    writeFileSync(CONTENT, JSON.stringify(doc, null, 2));
    sync();
    for (const name of OUTPUTS) {
      const text = read(name);
      assert.ok(
        !text.includes(today),
        `${name} contains today's date, so something reads the clock`,
      );
    }
    assert.ok(
      read("sitemap.xml").includes(pinned),
      "sitemap ignored the configured lastmod",
    );
  } finally {
    writeFileSync(CONTENT, original);
    sync();
  }
});

check("sitemap lastmod comes from content.json", () => {
  const content = JSON.parse(read("content.json"));
  assert.ok(
    read("sitemap.xml").includes(`<lastmod>${content.site.lastmod}</lastmod>`),
    "sitemap lastmod does not match site.lastmod",
  );
});

check("a malformed site.lastmod is rejected rather than guessed", () => {
  const original = read("content.json");
  try {
    const broken = JSON.parse(original);
    broken.site.lastmod = "24-07-2026";
    writeFileSync(CONTENT, JSON.stringify(broken, null, 2));
    assert.throws(() => sync(), /lastmod/i);
  } finally {
    writeFileSync(CONTENT, original);
    sync();
  }
});

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nPASS");
