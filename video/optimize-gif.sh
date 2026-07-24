#!/bin/sh
# Shrink the rendered GIF, if gifsicle is installed.
#
# Only ABSENCE of the tool is tolerated. A gifsicle that runs and fails must
# fail the build: an earlier version of this used
#   command -v gifsicle && gifsicle ... || echo 'not found'
# where the || binds to the whole && chain, so a real gifsicle error printed
# "not found" and exited 0, and the build reported success over a GIF that had
# been truncated in place.
#
# The optimisation writes to a temporary file and only replaces the original on
# success, so an aborted run cannot leave a half written GIF behind either.
set -eu

GIF="../assets/demo.gif"
TMP="$GIF.tmp"

if ! command -v gifsicle >/dev/null 2>&1; then
  echo "gifsicle not found, shipping the unoptimised GIF (brew install gifsicle)"
  exit 0
fi

# The temp file lives inside the tracked assets/ directory, so a failed run must
# not leave it there: it would sit next to the committed assets waiting to be
# picked up by a careless `git add assets`. The trap fires on success, on
# failure and on interrupt; `mv` has already consumed the file by then in the
# success case, which is why `rm -f` rather than `rm`.
trap 'rm -f "$TMP"' EXIT INT TERM

gifsicle -O3 --colors 128 --lossy=30 "$GIF" -o "$TMP"
mv "$TMP" "$GIF"
