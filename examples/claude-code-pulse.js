'use strict';

// Claude Code "answer is ready" notifier.
//
// If you installed the package, prefer the built-in command and skip this file
// entirely. It is one line in ~/.claude/settings.json:
//
//     { "type": "command", "command": "kbdlight pulse --detach" }
//
// This script does the same thing from a clone, and stays around as the
// hackable version: change the count, the peak, or the rhythm in one place
// without touching an installed package.
//
// WHAT IT DOES
//   Blinks the keyboard backlight four times, hard on and hard off, when Claude
//   Code finishes a response, so you know the agent is done without watching the
//   terminal. Square edges on purpose: a ramped fade gets integrated by the eye
//   into a vague glow and is easy to miss out of the corner of your vision.
//
// HOW IT IS WIRED
//   Registered as a `Stop` hook in ~/.claude/settings.json. Claude Code runs
//   the hook command when it stops generating and pipes a small JSON payload
//   to stdin. See examples/README.md for the settings snippet.
//
//   The engine, including the detach, the lock and the mute, lives in
//   src/pulse.js and is documented there.
//
// USAGE
//   node examples/claude-code-pulse.js            detach and return at once
//   node examples/claude-code-pulse.js --wait     blink in the foreground
//   node examples/claude-code-pulse.js --mute-until 10:00
//   node examples/claude-code-pulse.js --unmute
//
// ENV
//   KBD_PULSE_COUNT     number of blinks       (default 4)
//   KBD_PULSE_PEAK      on brightness 0..1     (default 1)
//   KBD_PULSE_ON_MS     time lit, in ms        (default 1000)
//   KBD_PULSE_OFF_MS    time dark, in ms       (default 500)
//   KBD_PULSE_PREDARK_MS  dark phase first     (default 400)

const pulse = require('../src/pulse.js');

const argv = process.argv.slice(2);
const has = (name) => argv.includes('--' + name);

const muteArg = argv.indexOf('--mute-until');
if (muteArg !== -1) {
  const at = pulse.muteUntil(pulse.parseUntil(argv[muteArg + 1] || ''));
  console.log('pulse notifier muted until ' + at.toLocaleString());
  return;
}

if (has('unmute')) {
  console.log(pulse.unmute() ? 'pulse notifier unmuted' : 'pulse notifier was not muted');
  return;
}

// Claude Code waits for a Stop hook to exit before the turn ends, so the
// default is to hand the blinking to a detached child and return at once.
if (!has('wait')) {
  // detachAndExit re-runs this same script (process.argv[1]) with these args.
  pulse.detachAndExit(['--wait']);
  return;
}

pulse
  .blink({
    count: process.env.KBD_PULSE_COUNT,
    peak: process.env.KBD_PULSE_PEAK,
    onMs: process.env.KBD_PULSE_ON_MS,
    offMs: process.env.KBD_PULSE_OFF_MS,
    preDarkMs: process.env.KBD_PULSE_PREDARK_MS,
  })
  .catch(() => {
    // No backlit keyboard, or not macOS. A notifier must never break the hook
    // it is attached to, so this exits quietly.
  });
