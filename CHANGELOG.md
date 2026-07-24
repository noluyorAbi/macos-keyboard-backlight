# Changelog

All notable changes to macos-keyboard-backlight are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
