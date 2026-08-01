import { fromAnsi } from "./ansi";
import type { Content } from "./content-types";

/**
 * Real captured stdout of `kbdlight --help`, taken with:
 *
 *   script -q /dev/null node bin/kbdlight.js --help > /tmp/capture.txt
 *
 * Nothing here is retyped or invented, escape codes included: since 1.1.0 the
 * help is colour coded on a terminal, and `script` gives it one, so what the
 * video renders is the palette a real shell prints. fromAnsi resolves those
 * codes through the same xterm-256 table ansi.ts uses.
 *
 * Why the help screen rather than a state change: this tool's visible output is
 * a single number, so a `set` then `get` sequence shows almost nothing on
 * screen. The help text is the honest way to show the whole interface at once,
 * and it carries the one thing every new user gets wrong, which is that the
 * ambient sensor overrides a fixed level.
 */
const CAPTURED_OUTPUT = `
\u001b[1m\u001b[36mkbdlight\u001b[0m - control the MacBook keyboard backlight

\u001b[1mUsage:\u001b[0m
  \u001b[2mkbdlight\u001b[0m \u001b[1m\u001b[32mget\u001b[0m                 print brightness (0.0-1.0) of each keyboard
  \u001b[2mkbdlight\u001b[0m \u001b[1m\u001b[32mset\u001b[0m \u001b[33m<0.0-1.0>\u001b[0m       set brightness on all keyboards
  \u001b[2mkbdlight\u001b[0m \u001b[1m\u001b[32moff\u001b[0m                 turn backlight off (alias for: set 0)
  \u001b[2mkbdlight\u001b[0m \u001b[1m\u001b[32mmax\u001b[0m                 full brightness (alias for: set 1)
  \u001b[2mkbdlight\u001b[0m \u001b[1m\u001b[32mauto\u001b[0m                print auto-brightness state (1/0) per keyboard
  \u001b[2mkbdlight\u001b[0m \u001b[1m\u001b[32mauto\u001b[0m \u001b[33m<on|off>\u001b[0m       enable/disable ambient auto-brightness
  \u001b[2mkbdlight\u001b[0m \u001b[1m\u001b[32mlist\u001b[0m                print keyboard backlight IDs
  \u001b[2mkbdlight\u001b[0m \u001b[1m\u001b[32mpulse\u001b[0m \u001b[33m[count]\u001b[0m       blink as a notification, then restore (default 4)
  \u001b[2mkbdlight\u001b[0m \u001b[1m\u001b[32msun\u001b[0m \u001b[33m[on|off]\u001b[0m        follow sunrise and sunset (see below)
  \u001b[2mkbdlight\u001b[0m \u001b[36m-h\u001b[0m | \u001b[36m--help\u001b[0m         show this help
  \u001b[2mkbdlight\u001b[0m \u001b[36m-v\u001b[0m | \u001b[36m--version\u001b[0m      show version

\u001b[1mSun mode:\u001b[0m
  \u001b[2mkbdlight\u001b[0m \u001b[1m\u001b[32msun\u001b[0m                 today's sunrise/sunset and what is armed
  \u001b[2mkbdlight\u001b[0m \u001b[1m\u001b[32msun on\u001b[0m              dark by day, lit after sunset, from now on
  \u001b[2mkbdlight\u001b[0m \u001b[1m\u001b[32msun off\u001b[0m             stop, and put back the state it found
  \u001b[2mkbdlight\u001b[0m \u001b[1m\u001b[32msun apply\u001b[0m           switch now (what the scheduled agent runs)

  \u001b[36m--night\u001b[0m \u001b[33m<0.0-1.0|auto>\u001b[0m       level after sunset (default 0.6)
  \u001b[36m--day\u001b[0m \u001b[33m<0.0-1.0|auto>\u001b[0m         level after sunrise (default 0, off)
  \u001b[36m--at\u001b[0m \u001b[33m<lat,lon>\u001b[0m               coordinates (default: the system timezone)
  \u001b[36m--rise-offset\u001b[0m \u001b[33m<min>\u001b[0m          shift the sunrise switch, + later, - earlier
  \u001b[36m--set-offset\u001b[0m \u001b[33m<min>\u001b[0m           shift the sunset switch the same way
  \u001b[36m--force\u001b[0m                      apply even if the phase has not changed

\u001b[1mPulse options:\u001b[0m
  \u001b[36m--detach\u001b[0m                     return at once, blink in a background process
  \u001b[36m--peak\u001b[0m \u001b[33m<0.0-1.0>\u001b[0m             brightness of the lit phase (default 1)
  \u001b[36m--on <ms> / --off <ms>\u001b[0m       lit and dark time per blink (default 1000 / 500)
  \u001b[36m--predark\u001b[0m \u001b[33m<ms>\u001b[0m               dark phase before the first blink (default 400)
  \u001b[36m--mute-until\u001b[0m \u001b[33m<time>\u001b[0m          stay quiet until "09:00" or an ISO timestamp
  \u001b[36m--unmute\u001b[0m                     end a mute early
  \u001b[36m--status\u001b[0m                     print whether a mute is in force

\u001b[1mOutput:\u001b[0m
  \u001b[36m--color / --no-color\u001b[0m         force colour on or off
  \u001b[2mNO_COLOR and FORCE_COLOR are obeyed; colour is off when piped.\u001b[0m

\u001b[1mNotes:\u001b[0m
  Auto-brightness (the ambient light sensor) keeps adjusting the backlight and
  will override a fixed value. To hold a level, disable it first:
  \u001b[32m  kbdlight auto off && kbdlight set 0.5\u001b[0m
  Re-enable the sensor with: kbdlight auto on

  "auto" is the hardware sensor reacting to the room right now. "sun" is a
  schedule computed from sunrise and sunset at your coordinates, so it tracks
  the season instead of a clock time. They compose: --day auto hands the
  daylight hours back to the sensor and keeps the evening on a fixed level.

  "kbdlight pulse" restores the exact brightness and auto-brightness state it
  found, so it is safe to fire from an editor hook or a scheduled job. Use
  --detach there: hook runners wait for the command to exit, and blinking takes
  about a second.
`;

export const content: Content = {
  name: "macos-keyboard-backlight",

  tagline: "Your keyboard backlight, finally scriptable.",

  description:
    "Reads and sets the MacBook keyboard backlight from a shell or from Node.",

  install: "npm i -g macos-keyboard-backlight",

  repoUrl: "github.com/noluyorAbi/macos-keyboard-backlight",

  siteUrl: "kbdlight.adatepe.dev",

  /* Apple's system blue, the same one the landing page fills its controls
     with. The page and the clip have to read as one piece of work, and the
     page is now set in Apple's product-page language. */
  accent: "#0071e3",

  highlights: ["follows the sun", "no build step", "MIT"],

  coldOpen: [
    "A slider in System Settings.",
    "Two keys on the keyboard.",
    "No way to script either one.",
  ],

  windowTitle: "kbdlight",

  demo: {
    kind: "terminal",
    command: "kbdlight --help",
    lines: fromAnsi(CAPTURED_OUTPUT.replace(/^\n/, "")),
  },
};
