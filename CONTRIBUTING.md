# Contributing

Thanks for considering it. This is a small, deliberately narrow package, so the
fastest way to get a change merged is to keep it narrow too.

## Before you open a pull request

Open an issue first for anything that changes behaviour, adds a command, or adds
a dependency. The package currently has exactly one runtime dependency and the
bar for a second one is high.

Typo fixes, documentation and test improvements need no issue. Just send them.

## Requirements

- macOS, Apple Silicon or Intel. The package cannot be meaningfully tested
  anywhere else: the smoke test skips itself on other platforms, so a green run
  on Linux proves nothing.
- Node.js 18 or newer.
- A Mac with a backlit keyboard, for the same reason.

## Setup

```sh
git clone https://github.com/noluyorAbi/macos-keyboard-backlight.git
cd macos-keyboard-backlight
npm install
npm test
node bin/kbdlight.js get
```

`npm test` drives the real hardware. It snapshots the current brightness and
auto-brightness state, exercises the API, and restores both in a `finally` block.
If it ever leaves your backlight in a strange state, that is a bug worth
reporting on its own.

## House rules

These are enforced in CI, so a pull request that breaks one goes red:

- **No em dashes or en dashes.** Use a comma, semicolon, colon, period or
  parentheses.
- **No emoji**, anywhere in the repository.
- English for code, identifiers, comments, commit messages and pull requests.

## Style

There is no linter and no build step, on purpose. Match the surrounding code:
two-space indentation, single quotes, semicolons, `'use strict'` at the top of
every file. Comments explain why, not what.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org):
`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`.

## Touching the FFI layer

`src/index.js` calls into a private Apple framework through `objc_msgSend`. Two
things to know before you change it:

1. Every distinct Objective-C method signature needs its own koffi prototype.
   `objc_msgSend` is variadic in C, and calling it through the wrong prototype
   does not fail loudly, it silently reads the wrong registers. If you add a
   selector, add a matching entry to the `msg` table rather than reusing a close
   one.
2. Verify the change against real hardware and include what you observed in the
   pull request. "Works on my M1, macOS 26.4" is useful. "Should work" is not.

## Contributor agreement

This project is MIT licensed. There is no CLA. By contributing you agree that
your contribution is provided under the same MIT license as the rest of the
project, and you confirm you have the right to submit it, which is the
[Developer Certificate of Origin](https://developercertificate.org/).

Sign off your commits to state that explicitly:

```sh
git commit -s -m "fix: clamp brightness before the FFI call"
```

## Reporting a security issue

Do not open a public issue. Follow [SECURITY.md](SECURITY.md).
