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
  kbdlight -h | --help         show this help
  kbdlight -v | --version      show version

Notes:
  Auto-brightness (the ambient light sensor) keeps adjusting the backlight and
  will override a fixed value. To hold a level, disable it first:
    kbdlight auto off && kbdlight set 0.5
  Re-enable the sensor with: kbdlight auto on
`;

function fail(msg) {
  process.stderr.write('kbdlight: ' + msg + '\n');
  process.exit(1);
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

      default:
        fail('unknown command "' + cmd + '"\n\n' + USAGE);
    }
  } catch (e) {
    fail(e.message);
  }
}

main(process.argv.slice(2));
