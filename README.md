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

<a href="https://kbdlight.adatepe.dev?utm_source=readme&utm_medium=header">kbdlight.adatepe.dev</a>

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
kbdlight sun on           follow sunrise and sunset (see below)
kbdlight --help
```

The help is colour-coded when it is going to a terminal, and plain when it is
piped. `NO_COLOR`, `FORCE_COLOR` and `--no-color` all work.

### Holding a fixed level

This is the part that surprises people. Auto-brightness keeps re-adjusting the
backlight from the ambient light sensor, so a level you set drifts back on its
own. Turn the sensor off first, and the value sticks:

```sh
kbdlight auto off && kbdlight set 0.5
```

Re-enable the sensor later with `kbdlight auto on`.

## Sun mode

`kbdlight sun on` puts the backlight on the sky's schedule: off through the day,
up to a level you pick after sunset, back down at sunrise.

```sh
kbdlight sun on                       # dark by day, 0.6 after sunset
kbdlight sun on --night 0.4 --day auto
kbdlight sun                          # today's times and what is armed
kbdlight sun off                      # stop, and put back the state it found
```

```
sun mode: on
  where    52.52, 13.41 (Europe/Berlin)
  sunrise  05:26   sunset 20:58
  now      night, level 0.60
  next     2.8.2026, 05:28:02
  agent    loaded (checks every 5 min)
```

Sunrise and sunset are computed locally with the NOAA solar algorithm, so the
switch tracks the season instead of a clock time that is right in March and an
hour wrong in June. Coordinates come from the machine's timezone, which is a
city name and therefore accurate to well under the minute that matters here.
Pass `--at 48.14,11.58` once if you want your own, and `--rise-offset` /
`--set-offset` to shift either switch by a number of minutes.

A `launchd` agent (`local.kbdlight.sun`) re-checks every five minutes rather
than firing at two computed times. Sunrise moves daily, so a clock-time job has
to rewrite itself every day and can drift, double up, or quietly disappear; a
poll cannot. It also catches up on the first wake if the Mac slept through the
moment.

Between two checks the keyboard is yours: the agent only writes on a phase
change, so turning the backlight down in the evening sticks. `kbdlight sun off`
unloads the agent and restores the exact brightness and sensor state from before
sun mode started.

`auto` and `sun` are independent and compose. `auto` is the hardware ambient
sensor reacting to the room right now; `sun` is a schedule. `--day auto` hands
the daylight hours back to the sensor and keeps the evening on a fixed level.

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

**Backlight off during the day, lit in the evening.** This used to be a shell
script comparing `date +%H` against two numbers you had to keep re-tuning as the
seasons moved. It is now `kbdlight sun on`; see [Sun mode](#sun-mode).

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

## Your keyboard as a status light

Once brightness is scriptable, the backlight becomes an output device for
anything your machine knows. Three working programs live in
[`examples/`](examples/).

### Know when Claude Code is done, without watching the terminal

You send a prompt, switch to a browser, and then keep checking back to see
whether the agent has finished. Add one line to `~/.claude/settings.json` and
the keyboard blinks four times when the answer lands.

```json
{
  "hooks": {
    "Stop": [
      { "hooks": [{ "type": "command", "command": "kbdlight pulse --detach" }] }
    ]
  }
}
```

<div align="center">

<img src="https://raw.githubusercontent.com/noluyorAbi/macos-keyboard-backlight/main/assets/pulse.gif" width="100%" alt="A MacBook keyboard seen from above. A status line flips from working to response ready, the backlight goes dark for a moment, then blinks four times and returns to the level it started at.">

<sub>The rhythm is the shipped default, frame for frame. The MacBook is an illustration: the backlight is hardware, so no screen recording can show it.</sub>

</div>

Hard on, hard off, four times. Not a fade: in peripheral vision a ramp gets
integrated into a vague glow and you miss it, which defeats the entire purpose.

The timing is slow for the same reason, and the hardware is not the constraint.
Measured through `backlightLevelForKeyboard:`, which reports the driver's real
output instead of the value you asked for, the LEDs reach full within 26 ms and
drop just as fast. What needs the second of lit time is the room.

```sh
kbdlight pulse                      # 4 blinks, then exactly the state it found
kbdlight pulse 2 --peak 0.6         # quieter
kbdlight pulse --mute-until 09:00   # nothing until morning
kbdlight pulse --unmute
```

The hook returns in about 50 ms. Claude Code waits for `Stop` hooks before the
turn ends, so `--detach` hands the blinking to a background process instead of
holding your session for a second. A lock file keeps two overlapping runs from
fighting over the hardware: without it, the second run would snapshot the
keyboard mid-blink and "restore" it to dark on the way out.

Works the same in any hook that runs a command, for a long build or a finished
test run. [`examples/claude-code-pulse.js`](examples/claude-code-pulse.js) is the
hackable version of the same thing if you would rather edit a script than pass
flags.

### Keep a dark room dark, and get the light back

```sh
node examples/night-mode.js --until 10:00   # dark now, restore at 10:00
node examples/night-mode.js --status
node examples/night-mode.js --cancel
```

The restore is the point. It snapshots the level and the auto-brightness flag
per keyboard and schedules the exact reverse as a self-removing launchd agent,
because a `setTimeout` seven hours out dies with the terminal, the logout, or
the reboot, and "dark until 10:00" with no way back on is just "dark".

### Flash on the kick drum

```sh
node examples/music-sync.js --verbose
```

`ffmpeg` decodes a loopback device (or the microphone) to mono 8 kHz, a one-pole
low-pass isolates the bass band, and a frame counts as a beat when its energy
beats the last second's average. Against a synthetic 120 bpm track it reports
beats 480 to 512 ms apart, averaging exactly 120 bpm.

### What is not possible

A MacBook backlight is a **single zone**: one channel for the whole board, no
per-key addressing, no colour. Every selector on Apple's private
`KeyboardBrightnessClient` takes a keyboard ID and nothing finer. So brightness
over time is the only axis there is, and per-key effects need an external RGB
keyboard driven over its own vendor protocol.

The examples are in the git repository, not in the npm package.

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
