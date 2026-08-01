#!/usr/bin/env node
'use strict';

const kbd = require('../src/index.js');
const { colors, width } = require('../src/color.js');

// --- help -----------------------------------------------------------------

// The help text is data, not a template string, for two reasons: the columns
// stay aligned once the words carry escape codes (padding has to be computed
// from printable width, which a literal cannot do), and the colour of a flag is
// decided once here instead of at every mention.

const DESC_COLUMN = 31;

const USAGE = [
  { cmd: 'get', desc: 'print brightness (0.0-1.0) of each keyboard' },
  { cmd: 'set', arg: '<0.0-1.0>', desc: 'set brightness on all keyboards' },
  { cmd: 'off', desc: 'turn backlight off (alias for: set 0)' },
  { cmd: 'max', desc: 'full brightness (alias for: set 1)' },
  { cmd: 'auto', desc: 'print auto-brightness state (1/0) per keyboard' },
  { cmd: 'auto', arg: '<on|off>', desc: 'enable/disable ambient auto-brightness' },
  { cmd: 'list', desc: 'print keyboard backlight IDs' },
  { cmd: 'pulse', arg: '[count]', desc: 'blink as a notification, then restore (default 4)' },
  { cmd: 'sun', arg: '[on|off]', desc: 'follow sunrise and sunset (see below)' },
  {
    raw: (c) => c.prog('kbdlight') + ' ' + c.flag('-h') + ' | ' + c.flag('--help'),
    desc: 'show this help',
  },
  {
    raw: (c) => c.prog('kbdlight') + ' ' + c.flag('-v') + ' | ' + c.flag('--version'),
    desc: 'show version',
  },
];

const SUN = [
  { cmd: 'sun', desc: "today's sunrise/sunset and what is armed" },
  { cmd: 'sun on', desc: 'dark by day, lit after sunset, from now on' },
  { cmd: 'sun off', desc: 'stop, and put back the state it found' },
  { cmd: 'sun apply', desc: 'switch now (what the scheduled agent runs)' },
  { blank: true },
  { flag: '--night', arg: '<0.0-1.0|auto>', desc: 'level after sunset (default 0.6)' },
  { flag: '--day', arg: '<0.0-1.0|auto>', desc: 'level after sunrise (default 0, off)' },
  { flag: '--at', arg: '<lat,lon>', desc: 'coordinates (default: the system timezone)' },
  { flag: '--rise-offset', arg: '<min>', desc: 'shift the sunrise switch, + later, - earlier' },
  { flag: '--set-offset', arg: '<min>', desc: 'shift the sunset switch the same way' },
  { flag: '--force', desc: 'apply even if the phase has not changed' },
];

const PULSE = [
  { flag: '--detach', desc: 'return at once, blink in a background process' },
  { flag: '--peak', arg: '<0.0-1.0>', desc: 'brightness of the lit phase (default 1)' },
  { flag: '--on <ms> / --off <ms>', desc: 'lit and dark time per blink (default 1000 / 500)' },
  { flag: '--predark', arg: '<ms>', desc: 'dark phase before the first blink (default 400)' },
  { flag: '--mute-until', arg: '<time>', desc: 'stay quiet until "09:00" or an ISO timestamp' },
  { flag: '--unmute', desc: 'end a mute early' },
  { flag: '--status', desc: 'print whether a mute is in force' },
];

const OUTPUT = [
  { flag: '--color / --no-color', desc: 'force colour on or off' },
  { blank: true, note: 'NO_COLOR and FORCE_COLOR are obeyed; colour is off when piped.' },
];

const NOTES = [
  'Auto-brightness (the ambient light sensor) keeps adjusting the backlight and',
  'will override a fixed value. To hold a level, disable it first:',
  { code: '  kbdlight auto off && kbdlight set 0.5' },
  'Re-enable the sensor with: kbdlight auto on',
  '',
  '"auto" is the hardware sensor reacting to the room right now. "sun" is a',
  'schedule computed from sunrise and sunset at your coordinates, so it tracks',
  'the season instead of a clock time. They compose: --day auto hands the',
  'daylight hours back to the sensor and keeps the evening on a fixed level.',
  '',
  '"kbdlight pulse" restores the exact brightness and auto-brightness state it',
  'found, so it is safe to fire from an editor hook or a scheduled job. Use',
  '--detach there: hook runners wait for the command to exit, and blinking takes',
  'about a second.',
];

function renderRow(row, c) {
  if (row.blank) return row.note ? '  ' + c.note(row.note) : '';

  let left;
  if (row.raw) left = row.raw(c);
  else if (row.flag) left = c.flag(row.flag);
  else left = c.prog('kbdlight') + ' ' + c.cmd(row.cmd);
  if (row.arg) left += ' ' + c.arg(row.arg);

  left = '  ' + left;
  const gap = DESC_COLUMN - width(left);
  return left + ' '.repeat(gap > 0 ? gap : 1) + row.desc;
}

function renderSection(title, rows, c) {
  return [c.head(title + ':')].concat(rows.map((r) => renderRow(r, c))).join('\n');
}

function help(stream, argv) {
  const c = colors(stream, argv);
  const notes = NOTES.map((n) => (typeof n === 'string' ? (n && '  ' + n) : '  ' + c.code(n.code)));

  return (
    c.title('kbdlight') +
    ' - control the MacBook keyboard backlight\n\n' +
    renderSection('Usage', USAGE, c) +
    '\n\n' +
    renderSection('Sun mode', SUN, c) +
    '\n\n' +
    renderSection('Pulse options', PULSE, c) +
    '\n\n' +
    renderSection('Output', OUTPUT, c) +
    '\n\n' +
    c.head('Notes:') +
    '\n' +
    notes.join('\n') +
    '\n'
  );
}

function fail(msg) {
  process.stderr.write('kbdlight: ' + msg + '\n');
  process.exit(1);
}

// --- pulse ----------------------------------------------------------------

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

// --- sun ------------------------------------------------------------------

// Flag name on the command line -> property name in the saved config. Same
// reason as the pulse table: a value that is not consumed as a value gets read
// as the sub-command.
const SUN_VALUE_FLAGS = {
  night: 'night',
  day: 'day',
  at: 'at',
  'rise-offset': 'riseOffset',
  'set-offset': 'setOffset',
};

function parseSunArgs(args) {
  const opts = {};
  let sub;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const name = arg.slice(2);
      if (name === 'force') {
        force = true;
      } else if (SUN_VALUE_FLAGS[name]) {
        const v = args[i + 1];
        if (v == null || v.startsWith('--')) fail('--' + name + ' needs a value');
        opts[SUN_VALUE_FLAGS[name]] = v;
        i++;
      } else if (name !== 'color' && name !== 'no-color') {
        fail('sun: unknown option "' + arg + '"');
      }
      continue;
    }

    if (sub != null) fail('sun takes one sub-command, got "' + sub + '" and "' + arg + '"');
    sub = arg;
  }

  return { sub: sub || 'status', opts, force };
}

const HHMM = (d) =>
  d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';

function levelText(level) {
  if (level === 'auto') return 'auto (ambient sensor)';
  if (Number(level) === 0) return 'off';
  return Number(level).toFixed(2);
}

function printSunStatus(c) {
  const sun = require('../src/sun.js');
  const s = sun.status();
  const out = [];
  const row = (label, value) => out.push('  ' + c.note(label.padEnd(9)) + value);

  if (!s.on) {
    out.push(c.head('sun mode: ') + c.warn('off'));
    if (s.agent) {
      row('agent', c.warn('loaded but there is no config; run: kbdlight sun off'));
    } else {
      row('start it', c.code('kbdlight sun on'));
    }
    process.stdout.write(out.join('\n') + '\n');
    return;
  }

  const cfg = s.config;
  const p = s.plan;

  out.push(c.head('sun mode: ') + c.ok('on'));
  row(
    'where',
    c.value(cfg.lat.toFixed(2) + ', ' + cfg.lon.toFixed(2)) + ' ' + c.note('(' + cfg.source + ')')
  );

  if (p.polar) {
    row('sun', p.polar === 'day' ? 'up all day at this latitude' : 'down all day at this latitude');
  } else {
    row('sunrise', c.value(HHMM(p.sunrise)) + '   ' + c.note('sunset') + ' ' + c.value(HHMM(p.sunset)));
  }

  row('now', c.value(p.phase) + ', level ' + c.value(levelText(p.level)));
  row('next', p.next ? c.value(p.next.toLocaleString()) : c.note('no switch until the season turns'));
  row(
    'agent',
    (s.agent ? c.ok('loaded') : c.err('MISSING, nothing will switch')) +
      c.note(' (checks every ' + sun.TICK_SECONDS / 60 + ' min)')
  );
  if (cfg.appliedAt) row('applied', c.note(new Date(cfg.appliedAt).toLocaleString()));
  if (cfg.error) row('error', c.err(cfg.error));

  process.stdout.write(out.join('\n') + '\n');
}

function sunCommand(args, c) {
  const sun = require('../src/sun.js');
  const { sub, opts, force } = parseSunArgs(args);

  switch (sub) {
    case 'status':
      return printSunStatus(c);

    case 'on': {
      const r = sun.enable(opts);
      process.stdout.write(
        (r.rearmed ? 'sun mode re-armed' : 'sun mode armed') +
          c.note(' (the state from before it started is saved for "sun off")') +
          '\n'
      );
      return printSunStatus(c);
    }

    case 'off': {
      const r = sun.disable();
      if (!r.wasOn) {
        process.stdout.write('sun mode was already off\n');
        return;
      }
      const levels = r.restored && r.restored.map((v) => Number(v).toFixed(2)).join(', ');
      process.stdout.write(
        'sun mode off' + (levels ? ', restored ' + c.value(levels) : '') + '\n'
      );
      return;
    }

    case 'apply': {
      const r = sun.apply({ force });
      if (!r.ran) {
        process.stdout.write(c.note(r.reason) + '\n');
        return;
      }
      process.stdout.write(
        r.plan.phase + ': ' + c.value(levelText(r.plan.level)) + '\n'
      );
      return;
    }

    default:
      fail('sun: unknown sub-command "' + sub + '" (try: on, off, apply)');
  }
}

// --- main -----------------------------------------------------------------

function main(argv) {
  const cmd = argv[0] || 'get';

  if (cmd === '-h' || cmd === '--help' || cmd === 'help') {
    process.stdout.write(help(process.stdout, argv));
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

      case 'sun':
        return sunCommand(argv.slice(1), colors(process.stdout, argv));

      default:
        fail('unknown command "' + cmd + '"\n\n' + help(process.stderr, argv));
    }
  } catch (e) {
    fail(e.message);
  }
}

main(process.argv.slice(2));
