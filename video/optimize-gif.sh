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

if ! command -v gifsicle >/dev/null 2>&1; then
  echo "gifsicle not found, shipping the unoptimised GIF (brew install gifsicle)"
  exit 0
fi

gifsicle -O3 --colors 128 --lossy=30 "$GIF" -o "$GIF.tmp"
mv "$GIF.tmp" "$GIF"
