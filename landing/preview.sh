#!/bin/sh
# Serve this directory on http://localhost:4321 with nothing installed.
#
# The page is plain static files, so any static server works and Vercel needs
# none of this. Use it to look at the page before you deploy.
#
#   sh preview.sh          serve on port 4321
#   PORT=8080 sh preview.sh
set -eu

PORT="${PORT:-4321}"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Serving $DIR on http://localhost:$PORT"
echo "Stop with Ctrl-C."
exec python3 -m http.server "$PORT" --directory "$DIR"
