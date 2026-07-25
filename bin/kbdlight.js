#!/usr/bin/env node
'use strict';

const kbd = require('../src/index.js');

const USAGE = `kbdlight - control the MacBook keyboard backlight

Usage:
  kbdlight get                 print brightness (0.0-1.0) of each keyboard
  kbdlight set <0.0-1.0>       set brightness on all keyboards
  kbdlight off                 turn backlight off (alias for: set 0)
  kbdlight max                 full brightness (alias for: set 1)
  kbdlight auto                print auto-brightness state (1/0) per keyboard
  kbdlight auto <on|off>       enable/disable ambient auto-brightness
  kbdlight list                print keyboard backlight IDs
  kbdlight pulse [count]       blink as a notification, then restore (default 4)
  kbdlight -h | --help         show this help
  kbdlight -v | --version      show version

Pulse options:
  --detach                     return at once, blink in a background process
  --peak <0.0-1.0>             brightness of the lit phase (default 1)
  --on <ms> / --off <ms>       lit and dark time per blink (default 1000 / 500)
  --predark <ms>               dark phase before the first blink (default 400)
  --mute-until <time>          stay quiet until "09:00" or an ISO timestamp
  --unmute                     end a mute early
  --status                     print whether a mute is in force

Notes:
  Auto-brightness (the ambient light sensor) keeps adjusting the backlight and
  will override a fixed value. To hold a level, disable it first:
    kbdlight auto off && kbdlight set 0.5
  Re-enable the sensor with: kbdlight auto on

  "kbdlight pulse" restores the exact brightness and auto-brightness state it
  found, so it is safe to fire from an editor hook or a scheduled job. Use
  --detach there: hook runners wait for the command to exit, and blinking takes
  about a second.
`;

function fail(msg) {
  process.stderr.write('kbdlight: ' + msg + '\n');
  process.exit(1);
}

// `kbdlight pulse`: a notification blink that puts the keyboard back exactly as
// it was. Kept in its own function because it is the one command with flags,
// an async body, and a deliberate "never break the caller" exit policy.
// Flags that consume the next argument. The parser has to know them, because
// otherwise the value of "--on 1000" looks exactly like the positional blink
// count and the command silently blinks a thousand times.
const PULSE_VALUE_FLAGS = ['peak', 'on', 'off', 'predark', 'mute-until'];

function parsePulseArgs(args) {
  const opts = {};
  const flags = new Set();
  let count;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const name = arg.slice(2);
      if (PULSE_VALUE_FLAGS.includes(name)) {
        const v = args[i + 1];
        if (v == null || v.startsWith('--')) fail('--' + name + ' needs a value');
        opts[name] = v;
        i++; // consumed as a value, so it can never be read as the count
      } else {
        flags.add(name);
      }
      continue;
    }

    if (!/^\d+$/.test(arg)) fail('pulse expects a blink count, got "' + arg + '"');
    if (count != null) fail('pulse takes one count, got "' + count + '" and "' + arg + '"');
    count = arg;
  }

  return { opts, flags, count };
}

function pulse(args) {
  const p = require('../src/pulse.js');
  const { opts, flags, count } = parsePulseArgs(args);

  if (flags.has('status')) {
    const until = p.mutedUntil();
    process.stdout.write(until ? 'muted until ' + until.toLocaleString() + '\n' : 'not muted\n');
    return;
  }
  if (flags.has('unmute')) {
    process.stdout.write(p.unmute() ? 'unmuted\n' : 'was not muted\n');
    return;
  }
  if (opts['mute-until'] != null) {
    const at = p.parseUntil(opts['mute-until']);
    p.muteUntil(at);
    process.stdout.write('muted until ' + at.toLocaleString() + '\n');
    return;
  }

  if (flags.has('detach')) {
    // Hand the child every argument except --detach, or it would fork forever.
    return p.detachAndExit(['pulse'].concat(args.filter((a) => a !== '--detach')));
  }

  p.blink({
    count: count,
    peak: opts.peak,
    onMs: opts.on,
    offMs: opts.off,
    preDarkMs: opts.predark,
  }).catch((e) => {
    // A notifier that breaks the hook it hangs off is worse than a missed
    // blink, so this stays quiet unless a human is watching.
    if (process.stderr.isTTY) process.stderr.write('kbdlight: ' + e.message + '\n');
  });
}

function main(argv) {
  const cmd = argv[0] || 'get';

  if (cmd === '-h' || cmd === '--help' || cmd === 'help') {
    process.stdout.write(USAGE);
    return;
  }
  if (cmd === '-v' || cmd === '--version') {
    process.stdout.write(require('../package.json').version + '\n');
    return;
  }

  try {
    switch (cmd) {
      case 'get':
        for (const id of kbd.keyboardIDs()) {
          process.stdout.write(kbd.get(id).toFixed(4) + '\n');
        }
        return;

      case 'list':
        for (const id of kbd.keyboardIDs()) {
          process.stdout.write(id.toString() + '\n');
        }
        return;

      case 'set': {
        if (argv[1] == null) fail('set needs a level 0.0-1.0');
        const v = kbd.set(argv[1]);
        process.stdout.write(v.toFixed(4) + '\n');
        return;
      }

      case 'off':
        kbd.set(0);
        return;

      case 'max':
        kbd.set(1);
        return;

      case 'auto': {
        if (argv[1] == null) {
          for (const id of kbd.keyboardIDs()) {
            process.stdout.write((kbd.isAuto(id) ? 1 : 0) + '\n');
          }
          return;
        }
        const arg = String(argv[1]).toLowerCase();
        if (arg === 'on' || arg === '1' || arg === 'true') kbd.setAuto(true);
        else if (arg === 'off' || arg === '0' || arg === 'false') kbd.setAuto(false);
        else fail('auto expects on|off');
        return;
      }

      case 'pulse':
        return pulse(argv.slice(1));

      default:
        fail('unknown command "' + cmd + '"\n\n' + USAGE);
    }
  } catch (e) {
    fail(e.message);
  }
}

main(process.argv.slice(2));
