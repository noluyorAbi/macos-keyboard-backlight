# Security policy

## Supported versions

The latest released version on npm receives security fixes. Older versions do
not.

## Reporting a vulnerability

Do not open a public issue.

Report it privately through GitHub:

**[Report a vulnerability](https://github.com/noluyorAbi/macos-keyboard-backlight/security/advisories/new)**

That form is private between you and the maintainer. It creates a draft security
advisory where the fix can be discussed, and where you are credited by name when
it is published, unless you ask not to be.

### What to include

The more of this you can supply, the faster it gets fixed:

- what an attacker can do, in one sentence
- the affected version, and whether the current release is affected
- the macOS version and chip (Apple Silicon or Intel) you reproduced it on
- reproduction steps, ideally a minimal script
- the impact you believe it has

### Response

You will get a first reply within 7 days. If the report is confirmed, you will
get an estimated fix date with it. If it is not confirmed, you will get the
reasoning, not silence.

## Scope

This package calls a private Apple framework
(`CoreBrightness.KeyboardBrightnessClient`) through an in-process foreign
function interface, and it ships no network code, no telemetry and no
credentials. The realistic issue classes are therefore:

- **In scope**: argument handling that could corrupt memory or crash the host
  process through the FFI boundary; a code path that lets untrusted input reach
  `objc_msgSend`; a supply chain problem in the published tarball; incorrect
  clamping that could drive hardware outside its documented range.
- **Out of scope**: the fact that a private Apple API is used at all, which is a
  documented design decision and a stability risk rather than a vulnerability;
  anything requiring an attacker who already runs arbitrary code as your user,
  since at that point the keyboard backlight is not the asset at risk; behaviour
  changes introduced by a macOS update, which are bugs, not vulnerabilities.

Report anything you are unsure about. A borderline report costs a short reply
and is much cheaper than an unreported one.
