# Changelog

All notable changes to macos-keyboard-backlight are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-08-01

### Added

- `kbdlight pulse [count]`: blink the backlight as a notification and restore
  the exact brightness and auto-brightness state it found, so it is safe to fire
  from an editor hook or a scheduled job. Options: `--detach` (return at once
  and blink in a background process, for hook runners that wait for the command
  to exit), `--peak`, `--on`, `--off`, `--predark`, `--mute-until <time>`,
  `--unmute` and `--status`. The default rhythm is four blinks of one second lit
  and half a second dark, after a 400 ms dark phase: the LEDs reach full within
  26 ms, so the slow timing is about being noticed in a bright room, not about
  hardware.
- A lock file guards against overlapping runs, which would otherwise snapshot
  the keyboard mid-blink and restore it to dark.
- `kbdlight sun on`: put the backlight on the sky's schedule, dark through the
  day and lit after sunset. Sunrise and sunset are computed locally with the
  NOAA solar algorithm from coordinates derived from the machine's timezone, so
  there is no network call and no location permission; `--at <lat,lon>` sets
  them by hand. Options: `--night`, `--day` (both accept `auto` to hand a phase
  back to the ambient sensor), `--rise-offset`, `--set-offset` and `--force`.
  `kbdlight sun` reports the times and the schedule, `kbdlight sun off` restores
  the state from before sun mode started. A `launchd` agent re-checks every five
  minutes instead of firing at two computed times: sunrise moves daily, so a
  clock-time job has to rewrite itself and can drift or vanish, and a poll also
  catches up on the first wake after sleep. It writes only on a phase change, so
  a level set by hand during a phase is left alone.
- Colour in the help output, and a `Sun mode` section in it. Colour is off when
  the output is not a terminal, and `NO_COLOR`, `FORCE_COLOR`, `CLICOLOR_FORCE`,
  `--color` and `--no-color` are all honoured. Column padding is computed from
  printable width, so the two columns stay aligned either way.
- Tests for the parts with no hardware in them: the solar math against NOAA's
  published times, polar day and night, the day/night decision and its offsets,
  coordinate parsing, the colour rules, and the help's alignment.
- Examples in `examples/`, not shipped with the package: a Claude Code `Stop`
  hook notifier, a night mode that schedules its own restore through a
  self-removing launchd agent, and a music sync that flashes on the kick drum.

## [1.0.0] - 2026-07-24

### Added

- `kbdlight` command with `get`, `set <0.0-1.0>`, `off`, `max`, `auto [on|off]`
  and `list`.
- Node API: `get`, `set`, `isAuto`, `setAuto` and `keyboardIDs`, each accepting
  an optional keyboard ID so a single keyboard can be targeted instead of all of
  them.
- Brightness values are clamped to the 0.0 to 1.0 range before reaching the
  system call.
- Smoke test that drives real hardware and restores the previous brightness and
  auto-brightness state afterwards, skipping cleanly on hosts without a backlit
  keyboard.

[Unreleased]: https://github.com/noluyorAbi/macos-keyboard-backlight/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/noluyorAbi/macos-keyboard-backlight/releases/tag/v1.0.0
