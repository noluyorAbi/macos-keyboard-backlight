import { fromAnsi } from "./ansi";
import type { Content } from "./content-types";

/**
 * Real captured stdout of `kbdlight --help`, taken with:
 *
 *   script -q /dev/null node bin/kbdlight.js --help > /tmp/capture.txt
 *
 * Nothing here is retyped or invented. The command prints no colour, so there
 * are no escape codes to preserve; it renders in the terminal foreground.
 *
 * Why the help screen rather than a state change: this tool's visible output is
 * a single number, so a `set` then `get` sequence shows almost nothing on
 * screen. The help text is the honest way to show the whole interface at once,
 * and it carries the one thing every new user gets wrong, which is that the
 * ambient sensor overrides a fixed level.
 */
const CAPTURED_OUTPUT = `
kbdlight - control the MacBook keyboard backlight

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

export const content: Content = {
  name: "macos-keyboard-backlight",

  tagline: "Your keyboard backlight, finally scriptable.",

  description:
    "Reads and sets the MacBook keyboard backlight from a shell or from Node.",

  install: "npm i -g macos-keyboard-backlight",

  repoUrl: "github.com/noluyorAbi/macos-keyboard-backlight",

  siteUrl: "kbdlight.adatepe.dev",

  accent: "#d97757",

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
