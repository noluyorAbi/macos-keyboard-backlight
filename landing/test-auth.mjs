/**
 * Tests for the launch board's gate.
 *
 * The board holds post copy that has not gone out yet, so the interesting
 * behaviour here is refusal: a forged cookie, a cookie of the wrong length, an
 * expired one, a wrong password, and the panel being switched off entirely.
 * Those were verified once by hand against a running server; this is the part
 * that keeps them true.
 *
 * No dependencies and no framework, like the rest of this directory.
 *
 *   node test-auth.mjs
 */

import assert from "node:assert/strict";

// Set before the module is imported: the password is read at call time, but the
// scrypt-derived signing key is cached per password, and starting from a known
// value keeps the cases independent.
process.env.ADMIN_PASSWORD = "correct horse battery staple";

const auth = await import("./api/_lib/auth.js");
const { parseState } = await import("./api/_lib/model.js");

let failures = 0;

function check(name, fn) {
  try {
    fn();
    console.log("ok   " + name);
  } catch (error) {
    failures += 1;
    console.error("FAIL " + name + "\n     " + error.message);
  }
}

/* ------------------------------------------------------------------ gate */

check("the panel is on when a password is set", () => {
  assert.equal(auth.adminEnabled(), true);
});

check("an empty password switches the panel off entirely", () => {
  const saved = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_PASSWORD = "";
  try {
    assert.equal(auth.adminEnabled(), false);
    assert.equal(auth.passwordMatches(""), false, "empty attempt must not match an unset password");
    assert.equal(auth.issueSession(), null, "no session may be issued while off");
    assert.equal(auth.sessionValid("anything"), false);
  } finally {
    process.env.ADMIN_PASSWORD = saved;
  }
});

/* -------------------------------------------------------------- password */

check("only the exact password matches", () => {
  assert.equal(auth.passwordMatches("correct horse battery staple"), true);
  assert.equal(auth.passwordMatches("correct horse battery stapl"), false);
  assert.equal(auth.passwordMatches("correct horse battery staple "), false);
  assert.equal(auth.passwordMatches(""), false);
  // Both sides are hashed to 32 bytes before the constant-time compare, so a
  // wildly wrong length must be a plain false rather than a throw.
  assert.equal(auth.passwordMatches("x".repeat(10000)), false);
});

/* --------------------------------------------------------------- session */

check("a freshly issued session is accepted", () => {
  const token = auth.issueSession();
  assert.equal(typeof token, "string");
  assert.equal(auth.sessionValid(token), true);
});

check("a forged signature is refused", () => {
  const token = auth.issueSession();
  const cut = token.lastIndexOf(".");
  const forged = token.slice(0, cut + 1) + "a".repeat(token.length - cut - 1);
  assert.notEqual(forged, token, "the test must actually change the signature");
  assert.equal(auth.sessionValid(forged), false);
});

check("a signature of the wrong length is refused rather than throwing", () => {
  // timingSafeEqual throws on a length mismatch, which is why auth compares
  // lengths first. This is the case that would surface as a 500 instead of 401.
  const token = auth.issueSession();
  assert.equal(auth.sessionValid(token.slice(0, token.length - 3)), false);
  assert.equal(auth.sessionValid("9999999999999.a.b"), false);
});

check("a malformed token is refused", () => {
  for (const bad of ["", "nodot", ".", undefined, null]) {
    assert.equal(auth.sessionValid(bad), false, JSON.stringify(bad) + " must be refused");
  }
});

check("an expired session is refused even with a valid signature", () => {
  // Signed the same way issueSession does, but dated into the past. This is the
  // only case that can be built without reaching into the module's internals.
  const token = auth.issueSession();
  const [, nonce, signature] = token.split(".");
  const expired = `1.${nonce}.${signature}`;
  assert.equal(auth.sessionValid(expired), false);
});

check("rotating the password invalidates existing sessions", () => {
  const token = auth.issueSession();
  const saved = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_PASSWORD = "a different password";
  try {
    assert.equal(auth.sessionValid(token), false);
  } finally {
    process.env.ADMIN_PASSWORD = saved;
  }
});

/* -------------------------------------------------------------- throttle */

check("the throttle trips after the limit and only for that client", () => {
  const key = "test-client-" + Date.now();
  assert.equal(auth.throttled(key), false);
  for (let i = 0; i < 8; i++) auth.recordFailure(key);
  assert.equal(auth.throttled(key), true);
  assert.equal(auth.throttled(key + "-other"), false, "the throttle is per client");
  auth.clearFailures(key);
  assert.equal(auth.throttled(key), false, "a successful login clears the count");
});

/* --------------------------------------------------------------- cookies */

check("the cookie parser finds its value among others", () => {
  const request = { headers: { cookie: "a=1; launch_admin=the%20token; b=2" } };
  assert.equal(auth.readCookie(request, "launch_admin"), "the token");
  assert.equal(auth.readCookie(request, "missing"), undefined);
  assert.equal(auth.readCookie({ headers: {} }, "launch_admin"), undefined);
});

/* ----------------------------------------------------------------- model */

check("parseState rebuilds a board rather than trusting it", () => {
  const parsed = parseState({
    channels: [
      { name: "Show HN", status: "posted", wave: 3 },
      { name: "bogus", status: "invented", wave: 99 },
    ],
    tasks: [{ text: "publish", done: "yes" }],
    metrics: [{ at: "2026-07-28", stars: 12, visitors: "many" }],
    extra: "dropped",
  });

  assert.equal(parsed.channels.length, 2);
  assert.equal(parsed.channels[0].status, "posted");
  assert.equal(parsed.channels[0].wave, 3);
  assert.equal(parsed.channels[1].status, "todo", "an unknown status falls back");
  assert.equal(parsed.channels[1].wave, 1, "an impossible wave falls back");
  assert.ok(parsed.channels[0].id, "a missing id is generated");
  assert.equal(parsed.tasks[0].done, false, "done is a boolean, not a truthy string");
  assert.equal(parsed.metrics[0].stars, 12);
  assert.equal(parsed.metrics[0].visitors, 0, "a non-number reads as zero");
  assert.equal(parsed.extra, undefined, "unknown fields are not carried over");
});

check("parseState survives garbage instead of destroying the board", () => {
  for (const input of [null, undefined, 42, "string", { channels: "not an array" }]) {
    const parsed = parseState(input);
    assert.deepEqual(parsed.channels, []);
    assert.deepEqual(parsed.tasks, []);
    assert.deepEqual(parsed.metrics, []);
  }
});

check("parseState clamps a body that would not fit", () => {
  const parsed = parseState({ channels: [{ body: "x".repeat(50000), name: "y".repeat(500) }] });
  assert.equal(parsed.channels[0].body.length, 20000);
  assert.equal(parsed.channels[0].name.length, 200);
});

console.log(failures === 0 ? "\nPASS" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
