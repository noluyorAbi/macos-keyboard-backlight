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
 * NOTHING HERE WRITES TO THE REPOSITORY. Every check that has to generate or
 * mutate works on a throwaway copy in the system temp directory. An earlier
 * version edited the tracked content.json and restored it in a `finally`, which
 * meant a Ctrl-C at the wrong moment left the working tree holding a pinned or
 * deliberately malformed date. A test that can corrupt the thing it is testing
 * is not worth the coverage.
 *
 * Run: node test-sync.mjs
 */

import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const DIR = dirname(fileURLToPath(import.meta.url));
const OUTPUTS = ["index.html", "robots.txt", "sitemap.xml"];

/** Everything sync.mjs reads or writes. Nothing else needs copying. */
const SANDBOX_FILES = ["sync.mjs", "content.json", ...OUTPUTS];

/**
 * A disposable copy of the generator and its inputs.
 *
 * sync.mjs resolves its paths from its own location, so a copy in a temp
 * directory operates entirely on that copy.
 */
function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), "landing-sync-"));
  for (const name of SANDBOX_FILES) {
    cpSync(join(DIR, name), join(dir, name));
  }
  return {
    dir,
    read: (name) => readFileSync(join(dir, name), "utf8"),
    write: (name, text) => writeFileSync(join(dir, name), text),
    sync: (args = []) =>
      execFileSync("node", [join(dir, "sync.mjs"), ...args], {
        cwd: dir,
        encoding: "utf8",
      }),
    dispose: () => rmSync(dir, { recursive: true, force: true }),
  };
}

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

// Read-only against the real directory: --check writes nothing. If the
// committed output is stale, every other assertion is measuring the wrong tree.
check("committed output is in sync", () => {
  execFileSync("node", [join(DIR, "sync.mjs"), "--check"], {
    cwd: DIR,
    encoding: "utf8",
  });
});

check("two runs produce byte-identical output", () => {
  const box = sandbox();
  try {
    box.sync();
    const first = OUTPUTS.map(box.read);
    box.sync();
    const second = OUTPUTS.map(box.read);
    OUTPUTS.forEach((name, i) => {
      assert.equal(second[i], first[i], `${name} changed between two runs`);
    });
  } finally {
    box.dispose();
  }
});

check("no generated file reads the clock", () => {
  // Pin site.lastmod to a date that is definitely not today, regenerate, and
  // assert the output carries the configured date and never the current one.
  //
  // Comparing two back to back runs is not enough on its own: both would read
  // the same wall clock within the same second and agree. This is the check
  // that would actually have failed before the fix, on any day.
  const box = sandbox();
  try {
    const today = new Date().toISOString().slice(0, 10);
    const pinned = "2001-09-09";
    assert.notEqual(pinned, today, "pick a different pinned date");

    const doc = JSON.parse(box.read("content.json"));
    doc.site.lastmod = pinned;
    box.write("content.json", JSON.stringify(doc, null, 2));
    box.sync();

    for (const name of OUTPUTS) {
      assert.ok(
        !box.read(name).includes(today),
        `${name} contains today's date, so something reads the clock`,
      );
    }
    assert.ok(
      box.read("sitemap.xml").includes(pinned),
      "sitemap ignored the configured lastmod",
    );
  } finally {
    box.dispose();
  }
});

check("sitemap lastmod comes from content.json", () => {
  const content = JSON.parse(readFileSync(join(DIR, "content.json"), "utf8"));
  const sitemap = readFileSync(join(DIR, "sitemap.xml"), "utf8");
  assert.ok(
    sitemap.includes(`<lastmod>${content.site.lastmod}</lastmod>`),
    "sitemap lastmod does not match site.lastmod",
  );
});

check("a malformed site.lastmod is rejected rather than guessed", () => {
  const box = sandbox();
  try {
    const doc = JSON.parse(box.read("content.json"));
    doc.site.lastmod = "24-07-2026";
    box.write("content.json", JSON.stringify(doc, null, 2));
    assert.throws(() => box.sync(), /lastmod/i);
  } finally {
    box.dispose();
  }
});

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nPASS");
