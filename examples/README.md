# Examples

Two working programs built on this package, plus the small library they share.

They are not part of the published npm package (`files` in `package.json` ships
only `bin/` and `src/`). Clone the repo and run them from here.

```
examples/
  claude-code-pulse.js   blink the keyboard when Claude Code finishes answering
  night-mode.js          keyboard dark now, guaranteed back on at a set time
  music-sync.js          flash the keyboard on the kick drum
  lib/backlight.js       session handling: snapshot, blinks, ramps, restore
  lib/beat-detect.js     kick-drum onset detection over a float sample stream
  lib/pulse-mute.js      shared mute state for the notifier
```

## A note on the hardware limit

A MacBook keyboard backlight is a **single zone**: one channel for the whole
board, no per-key addressing and no colour. Every selector on the private
`KeyboardBrightnessClient` class takes a keyboard ID and nothing finer. So the
only thing an effect can shape is brightness over time, and everything here is
built on that one axis. Per-key effects require an external RGB keyboard driven
over its own vendor HID protocol, which is outside what this package does.

## Shared library

### `lib/backlight.js`

`session()` opens a session that owns the keyboard for the life of the script.

```js
const { session, sleep } = require('./lib/backlight');

const kb = session();
await kb.blink({ peak: 1, onMs: 1000, offMs: 500 }); // hard on, hard off
await kb.pulse({ peak: 1, attackMs: 40, decayMs: 120 }); // ramped, softer
await kb.ramp(0, 1, 500);
kb.write(0.5);
kb.restore();
```

`blink` and `pulse` are not interchangeable in practice. A ramp looks better
when you are watching the keyboard, but out of the corner of your eye the fade
gets integrated into a vague glow and is easy to miss. For a notification, use
`blink`; for something you sit and look at, use `pulse`.

It exists because two things are easy to get wrong:

- **State is per keyboard.** Brightness *and* the auto-brightness flag are stored
  per keyboard ID, and a Mac can have more than one backlit keyboard attached.
  The session snapshots every one of them before touching anything.
- **Auto-brightness fights manual writes.** The ambient sensor keeps correcting
  the level underneath you, so it is disabled for the duration and put back
  afterwards. Restore writes the level first and the auto flag last, because
  enabling the flag hands the level back to the sensor.

Restore runs on the normal path, on Ctrl-C, on `SIGTERM`, and on an uncaught
exception. `Ctrl-C` sets `kb.stopped` instead of exiting immediately, so loops
finish the frame they are on and unwind through their own `finally`.

### `lib/beat-detect.js`

`BeatDetector` turns a stream of mono 32-bit float samples into beat callbacks.

Method: low-pass the signal so only the bass band survives, reduce each 16 ms
frame to an energy value, and call a frame a beat when its energy exceeds the
average of the last second by a factor. Two guards keep it honest: an absolute
noise floor so silence never triggers, and a refractory window so a single kick
does not fire three times while it decays.

Time comes from the sample count, not the wall clock, so the detector behaves
identically on a live capture and on a file read at any speed. That is what
makes it testable:

```js
const { BeatDetector } = require('./lib/beat-detect');
const det = new BeatDetector({ onBeat: ({ timeMs }) => console.log(timeMs) });
det.push(buffer); // raw f32le bytes, partial frames are carried over
```

Against a synthetic 120 bpm kick track it reports beats 480 to 512 ms apart,
averaging exactly 120 bpm. The first second produces nothing, by design: the
comparison window has to fill first.

## `claude-code-pulse.js`

> If you installed the package, you do not need this file. `kbdlight pulse
> --detach` is the same notifier, shipped with the CLI, and the hook is one
> line. This script stays around as the hackable version, and the engine it
> calls (`src/pulse.js`) is shared with the command.


Blinks the backlight four times, hard on and hard off, when Claude Code
finishes a response, so you know the agent is done without watching the
terminal. The square edges are deliberate: a ramped fade is easy to miss in
peripheral vision, which is exactly where this thing lives.

```sh
node examples/claude-code-pulse.js --wait     # blink now, in the foreground
node examples/claude-code-pulse.js            # detach and return immediately
```

### Wiring it into Claude Code

Add a `Stop` hook to `~/.claude/settings.json` (or a project
`.claude/settings.json`):

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node /absolute/path/to/macos-keyboard-backlight/examples/claude-code-pulse.js"
          }
        ]
      }
    ]
  }
}
```

Tuning, without editing the file:

| Variable | Default | Meaning |
| --- | --- | --- |
| `KBD_PULSE_COUNT` | `4` | number of blinks |
| `KBD_PULSE_PEAK` | `1` | on brightness, 0 to 1 |
| `KBD_PULSE_ON_MS` | `1000` | time lit, per blink |
| `KBD_PULSE_OFF_MS` | `500` | time dark, per blink |
| `KBD_PULSE_PREDARK_MS` | `400` | dark phase before the first blink |

The timing is slow on purpose, and the hardware is not the reason. Measured
through `backlightLevelForKeyboard:`, which reports the driver's real output
instead of the value you asked for, the LEDs reach full within 26 ms and drop
just as fast. The constraint is the room: a backlight competing with daylight
needs roughly a second of lit time before someone who is not looking at the
keyboard notices anything. The dark phase in front helps for the same reason,
by separating the notification from whatever the backlight was doing before.

### Muting it for a while

A notifier that flashes a dark room at 04:00 is a notifier you will uninstall.

```sh
node examples/claude-code-pulse.js --mute-until 10:00   # next 10:00, today or tomorrow
node examples/claude-code-pulse.js --mute-until 2026-07-25T18:30
node examples/claude-code-pulse.js --unmute
```

The mute is one ISO timestamp in `~/.kbdlight-pulse-mute`, deliberately not in
the temp directory so it survives a reboot. An expired mute deletes itself on
the next run, so nothing needs scheduling to undo it. The check runs before the
detach, so a muted notifier does not even pay for the second `node` start.

### Two details that matter

**It detaches.** Claude Code waits for a `Stop` hook to exit before the turn is
finished, and pulsing takes about a second. So the first invocation re-spawns
itself detached and returns in a few milliseconds; the child does the pulsing.
Before it does, it drains stdin, because Claude Code writes the hook payload
there and exiting without reading it would hand the writer an `EPIPE`.

**It locks.** Two overlapping runs would be a real bug rather than just ugly:
the second one would snapshot the keyboard mid-pulse, see level 0, and
"restore" the machine to dark on the way out. A lock file in the temp directory
makes a second run bow out while one is in flight. A lock older than 10 seconds
is treated as stale, so a crashed run cannot disable the notifier permanently.

The script also exits quietly when there is no backlit keyboard or the host is
not macOS. A notifier must never break the hook it is attached to.

## `night-mode.js`

Takes the keyboard dark now and guarantees it comes back on at a time you name.

```sh
node examples/night-mode.js --until 10:00   # dark now, restore at 10:00
node examples/night-mode.js --until 2026-07-26T09:30
node examples/night-mode.js --status        # what is armed, if anything
node examples/night-mode.js --cancel        # restore right now
```

It snapshots the current level and auto-brightness flag per keyboard, writes
them to `~/.kbdlight-night-mode.json`, goes dark, mutes the pulse notifier for
the same window, and schedules the exact reverse.

The restore is the entire point. "Dark until 10:00" with no way back on is just
"dark", and you find out about it at 10:55.

### Why launchd, not a sleeping process

A `setTimeout` seven hours out dies with the terminal, the SSH session, the
logout, or the reboot. A launchd agent survives all four, and if the Mac is
asleep or powered off at the scheduled moment, launchd runs the job at the next
wake or boot instead of skipping it. The agent removes itself after firing, so
nothing lingers and nothing repeats tomorrow.

Three things this gets right that are easy to get wrong:

- **Delete the plist before `bootout`, not after.** When the agent unloads
  *itself*, `bootout` kills the running process, so anything sequenced after it
  never executes and the plist survives to be loaded again at the next login.
- **Re-arming keeps the first snapshot.** Running `--until` again while the
  keyboard is already dark must not record level 0 as the state to return to.
- **Don't schedule against an nvm path.** `~/.nvm/versions/node/v24.13.0/bin/node`
  disappears on the next nvm cleanup and leaves a job that cannot run, so the
  plist prefers `/opt/homebrew/bin/node` when the current interpreter is an nvm
  one.

A scheduled run that fires early, because launchd calendar entries are clock
times and a target can be more than a day out, checks the saved deadline and
goes back to sleep rather than restoring too soon. `--cancel` bypasses that
check: that one is a person saying stop now.

## `music-sync.js`

Flashes the backlight on the kick drum: snap to full on a beat, decay after,
with a dim floor that follows overall loudness so quiet passages stay lit and
loud ones glow.

```sh
node examples/music-sync.js                    # auto-pick a device, run until Ctrl-C
node examples/music-sync.js --list             # list capture devices and exit
node examples/music-sync.js --device blackhole # pick by name substring, or by index
node examples/music-sync.js --sensitivity 1.6  # less trigger-happy
node examples/music-sync.js --refractory 200   # minimum ms between beats
node examples/music-sync.js --seconds 30       # stop by itself
node examples/music-sync.js --verbose          # print beats and a running BPM
```

Requires `ffmpeg` (`brew install ffmpeg`).

### Getting the audio in

macOS gives no process access to system output audio. To react to what is
actually *playing*, install a loopback driver that presents the output as a
capture device:

```sh
brew install blackhole-2ch
```

Then in **Audio MIDI Setup** create a Multi-Output Device containing both your
speakers and BlackHole, and select it as the system output. You hear the music,
the script sees it. `music-sync.js` picks a loopback device automatically when
one is present.

Without a loopback device it falls back to the system default input, i.e. the
microphone, which works for music playing out loud in the room and needs
microphone permission for your terminal app. It deliberately does not fall back
to capture device index 0: on a Mac with Continuity that is often an iPhone
microphone.

### How it works

`ffmpeg` decodes the chosen device to mono 32-bit float at 8 kHz, which is
plenty of bandwidth for a kick drum at roughly 40 to 120 Hz. Those samples go
straight into `BeatDetector`.

The 16 ms render loop is deliberately decoupled from the audio callback: a beat
only sets the envelope to full, and the loop alone writes to the keyboard.
Otherwise a beat arriving mid-ramp would fight that ramp for the hardware.

If detection feels too eager or too sleepy, `--sensitivity` is the first knob:
it is the factor by which a frame must exceed the average of the last second.
`--refractory` is the second: raise it for slower music, lower it for
double-time material.
