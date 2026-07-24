<div align="center">

<img src="https://raw.githubusercontent.com/noluyorAbi/macos-keyboard-backlight/main/assets/banner.png" width="100%" alt="macos-keyboard-backlight: your keyboard backlight, finally scriptable">

<b>Control the MacBook keyboard backlight from the command line.</b>

<br>
<br>

<a href="https://www.npmjs.com/package/macos-keyboard-backlight"><img src="https://img.shields.io/npm/v/macos-keyboard-backlight?style=flat-square&color=d97757&labelColor=0b0b0b" alt="npm version"></a>
<a href="https://github.com/noluyorAbi/macos-keyboard-backlight/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/noluyorAbi/macos-keyboard-backlight/ci.yml?style=flat-square&labelColor=0b0b0b" alt="ci status"></a>
<a href="https://github.com/noluyorAbi/macos-keyboard-backlight/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/macos-keyboard-backlight?style=flat-square&color=3a3a3a&labelColor=0b0b0b" alt="MIT license"></a>
<img src="https://img.shields.io/badge/macOS-arm64%20%7C%20x64-3a3a3a?style=flat-square&labelColor=0b0b0b" alt="macOS arm64 and x64">
<img src="https://img.shields.io/badge/dependencies-1-3a3a3a?style=flat-square&labelColor=0b0b0b" alt="one runtime dependency">

<br>
<br>

<code>npm i -g macos-keyboard-backlight</code>&nbsp;&nbsp;then&nbsp;&nbsp;<code>kbdlight off</code>

<br>
<br>

<a href="https://macos-keyboard-backlight.vercel.app?utm_source=readme&utm_medium=header">macos-keyboard-backlight.vercel.app</a>

</div>

<br>

## What this is

macOS gives you a keyboard backlight and no way to script it. There is a slider
in System Settings and two keys on the keyboard, and that is the whole interface.
You cannot turn it off from a shell script, a scheduled job, or a Node program.

This package adds that missing interface, as a `kbdlight` command and as a small
Node API.

```sh
kbdlight get        # 0.5000
kbdlight set 0.2
kbdlight off
```

<div align="center">

<a href="https://github.com/noluyorAbi/macos-keyboard-backlight/blob/main/assets/demo.mp4">
  <img src="https://raw.githubusercontent.com/noluyorAbi/macos-keyboard-backlight/main/assets/demo.gif" width="100%" alt="A lit MacBook keyboard seen from above. The command kbdlight auto off and kbdlight off runs, and the backlight drains away key by key.">
</a>

<sub>The command is real. The MacBook is an illustration: the backlight is hardware, so no screen recording can show it. <a href="https://github.com/noluyorAbi/macos-keyboard-backlight/blob/main/assets/demo.mp4">Full quality version</a></sub>

</div>

There is **no native build step**. No node-gyp, no Xcode, no compiler on the
installing machine. It calls the system API directly from JavaScript through
[koffi](https://koffi.dev), which ships prebuilt for both Apple Silicon and Intel.

## Install

```sh
npm install -g macos-keyboard-backlight
```

That installs a `kbdlight` command. To run it once without installing:

```sh
npx macos-keyboard-backlight get
```

As a library in a project:

```sh
npm install macos-keyboard-backlight
```

## Command line

```
kbdlight get              print brightness (0.0-1.0) of each keyboard
kbdlight set <0.0-1.0>    set brightness on all keyboards
kbdlight off              backlight off  (alias for: set 0)
kbdlight max              full brightness (alias for: set 1)
kbdlight auto             print auto-brightness state (1/0) per keyboard
kbdlight auto off         disable the ambient light sensor
kbdlight auto on          re-enable it
kbdlight list             print keyboard backlight IDs
kbdlight --help
```

### Holding a fixed level

This is the part that surprises people. Auto-brightness keeps re-adjusting the
backlight from the ambient light sensor, so a level you set drifts back on its
own. Turn the sensor off first, and the value sticks:

```sh
kbdlight auto off && kbdlight set 0.5
```

Re-enable the sensor later with `kbdlight auto on`.

## Node API

```js
const kbd = require('macos-keyboard-backlight');

kbd.get();            // -> 0.5          brightness of the first keyboard
kbd.set(0.5);         // -> 0.5          set all keyboards, clamped to 0.0-1.0
kbd.isAuto();         // -> true         is auto-brightness enabled?
kbd.setAuto(false);   // -> false        disable the ambient sensor
kbd.keyboardIDs();    // -> [95159106]   IDs of backlit keyboards
```

`get`, `set`, `isAuto` and `setAuto` take an optional trailing `keyboardID` to
target one keyboard instead of all of them. `keyboardIDs()` takes no arguments;
it is what enumerates them:

```js
const [id] = kbd.keyboardIDs();
kbd.set(0.2, id);
```

All functions throw a descriptive `Error` on a non-macOS host, when
CoreBrightness cannot be reached, or when no backlit keyboard is present. Catch
it rather than feature-detecting:

```js
try {
  kbd.set(0);
} catch (e) {
  console.error('no backlight here:', e.message);
}
```

## Recipes

**Backlight off at night, back to automatic in the morning.** Put this behind a
`launchd` agent or a scheduled job:

```sh
#!/bin/zsh
hour=$(date +%H)
if [ "$hour" -ge 23 ] || [ "$hour" -lt 7 ]; then
  kbdlight auto off && kbdlight off
else
  kbdlight auto on
fi
```

**Dim the keyboard while a screen recording runs**, then restore it:

```js
const kbd = require('macos-keyboard-backlight');
const before = { level: kbd.get(), auto: kbd.isAuto() };

kbd.setAuto(false);
kbd.set(0);
await record();
kbd.set(before.level);
kbd.setAuto(before.auto);
```

Always snapshot `isAuto()` alongside the level. Restoring the brightness but
leaving the sensor disabled looks fine for a minute, then silently stops adapting
to the room.

## How it works

macOS exposes keyboard backlight control through `KeyboardBrightnessClient` in
the private `CoreBrightness` framework. This package resolves that class and its
selectors at runtime and calls them through `objc_msgSend` using koffi's foreign
function interface. Because the calls happen at runtime, nothing is compiled at
install time.

Two consequences worth stating plainly:

- **It uses a private Apple framework.** It works across current macOS releases,
  and Apple can change or remove that interface in any update without notice.
  The failure mode is a thrown `Error` rather than a crash, but plan for it in
  anything unattended.
- **Each Objective-C signature needs its own prototype.** `objc_msgSend` is
  variadic in C, so calling it through a mismatched prototype reads the wrong
  registers silently. That is why the code declares one typed entry per selector
  instead of reusing a close-enough one.

## Requirements

- macOS, Apple Silicon or Intel
- Node.js 18 or newer
- A Mac with a backlit keyboard

## Development

```sh
git clone https://github.com/noluyorAbi/macos-keyboard-backlight.git
cd macos-keyboard-backlight
npm install
npm test
```

`npm test` drives real hardware: it snapshots the current brightness and sensor
state, exercises the API, and restores both afterwards. On a machine with no
backlit keyboard, including every hosted CI runner, it skips itself rather than
reporting a pass it did not earn.

See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request, and
[SECURITY.md](SECURITY.md) to report a vulnerability privately.

## License

MIT. See [LICENSE](LICENSE).
