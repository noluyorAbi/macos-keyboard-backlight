# macos-keyboard-backlight

Control the MacBook keyboard backlight from the command line or Node.js. Get and
set brightness, and toggle the ambient-light auto-brightness, on any Apple Silicon
or Intel Mac.

macOS ships no CLI for this. It talks to the private CoreBrightness
`KeyboardBrightnessClient` API through [koffi](https://koffi.dev), so there is **no
native build step**: no node-gyp, no Xcode, no compiler. Install and run.

## Install

```sh
npm install -g macos-keyboard-backlight
```

This installs a `kbdlight` command. Or run once without installing:

```sh
npx macos-keyboard-backlight get
```

## CLI

```sh
kbdlight get              # print brightness (0.0-1.0) of each keyboard
kbdlight set 0.5          # set brightness on all keyboards
kbdlight off              # backlight off  (alias for: set 0)
kbdlight max              # full brightness (alias for: set 1)
kbdlight auto             # print auto-brightness state (1/0) per keyboard
kbdlight auto off         # disable the ambient light sensor
kbdlight auto on          # re-enable it
kbdlight list             # print keyboard backlight IDs
kbdlight --help
```

### Holding a fixed level

Auto-brightness keeps re-adjusting the backlight from the ambient light sensor and
will override a value you set. To hold a level, disable it first:

```sh
kbdlight auto off && kbdlight set 0.5
```

Re-enable the sensor later with `kbdlight auto on`.

## Node API

```js
const kbd = require('macos-keyboard-backlight');

kbd.get();            // -> 0.5      brightness of the first keyboard
kbd.set(0.5);         // -> 0.5      set all keyboards (clamped to 0.0-1.0)
kbd.isAuto();         // -> true     auto-brightness enabled?
kbd.setAuto(false);   // -> false    disable the ambient sensor
kbd.keyboardIDs();    // -> [95159106]  numeric IDs of backlit keyboards
```

Every function takes an optional trailing `keyboardID` (from `keyboardIDs()`) to
target a single keyboard instead of all of them:

```js
const [id] = kbd.keyboardIDs();
kbd.set(0.2, id);
```

All functions throw a descriptive `Error` on a non-macOS host or when no backlit
keyboard is present.

## How it works

`kbdlight` resolves the Objective-C selectors on `KeyboardBrightnessClient` at
runtime via `objc_msgSend` and calls them with koffi's foreign-function interface.
koffi ships prebuilt binaries for macOS arm64 and x64, so there is nothing to
compile at install time.

This relies on a private Apple framework. It works today across recent macOS
releases, but Apple can change the interface without notice.

## Requirements

- macOS (Apple Silicon or Intel)
- Node.js >= 16

## License

MIT
