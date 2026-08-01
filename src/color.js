'use strict';

// ANSI colour for the CLI, plus the width helper the help renderer needs to
// align columns that contain escape codes.
//
// Two rules a command-line tool has to get right, and both are about not
// deciding on the user's behalf:
//
//   1. NO_COLOR, set to anything non-empty, wins over every other signal. That
//      is the whole point of the convention (no-color.org).
//   2. Colour goes to terminals, not to pipes. `kbdlight --help | grep set`
//      has to match "set", not "\x1b[32mset".
//
// FORCE_COLOR and CLICOLOR_FORCE turn it back on for pagers and CI logs, which
// render escapes fine but are not TTYs. FORCE_COLOR=0 means off, because that
// is what every tool that reads the variable already does.

const CODES = {
  reset: 0,
  bold: 1,
  dim: 2,
  underline: 4,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
};

const ANSI_RE = /\u001b\[[0-9;]*m/g;

// Printable length: what the terminal shows, which is the only thing padding
// can be computed from once the text carries escape codes.
const width = (s) => String(s).replace(ANSI_RE, '').length;

const strip = (s) => String(s).replace(ANSI_RE, '');

function wantsColor(stream, argv) {
  const args = argv || [];
  if (args.includes('--no-color')) return false;
  if (args.includes('--color')) return true;

  const { NO_COLOR, FORCE_COLOR, CLICOLOR_FORCE, TERM } = process.env;
  if (NO_COLOR) return false;
  if (FORCE_COLOR != null && FORCE_COLOR !== '') return FORCE_COLOR !== '0';
  if (CLICOLOR_FORCE != null && CLICOLOR_FORCE !== '') return CLICOLOR_FORCE !== '0';
  if (TERM === 'dumb') return false;

  return !!(stream && stream.isTTY);
}

// The palette is named by role rather than by colour, so the help text reads as
// markup and every "what colour is a flag" decision lives in exactly one place.
function colors(stream, argv) {
  const on = wantsColor(stream, argv);

  const style = (...names) => {
    const prefix = names.map((n) => '\u001b[' + CODES[n] + 'm').join('');
    return (s) => (on ? prefix + s + '\u001b[0m' : String(s));
  };

  return {
    enabled: on,
    title: style('bold', 'cyan'), // the program name
    head: style('bold'), // section heading
    prog: style('dim'), // the "kbdlight" that repeats on every usage line
    cmd: style('bold', 'green'), // a literal sub-command
    arg: style('yellow'), // <placeholder>
    flag: style('cyan'), // --flag
    note: style('dim'), // prose under the commands
    code: style('green'), // an example command inside prose
    value: style('magenta'), // a number or time in program output
    ok: style('green'),
    warn: style('yellow'),
    err: style('red'),
  };
}

module.exports = { colors, wantsColor, width, strip };
