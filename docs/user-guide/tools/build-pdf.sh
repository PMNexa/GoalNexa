#!/usr/bin/env bash
# Build docs/user-guide/manual/GoalNexa-User-Manual.pdf from the Markdown.
# Needs pandoc and Google Chrome (or Chromium; set CHROME=/path/to/chrome).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
manual="$here/../manual"
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
if [ ! -x "$chrome" ]; then
  chrome="$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)"
fi
if [ -z "$chrome" ]; then
  echo "No Chrome or Chromium found - set CHROME=/path/to/chrome" >&2
  exit 1
fi
html="$manual/.GoalNexa-User-Manual.html"
log="$(mktemp)"
trap 'rm -f "$html" "$log"' EXIT
pandoc "$manual/GoalNexa-User-Manual.md" -f markdown -t html5 -s --toc --toc-depth=2 \
  --css "$here/manual.css" -V document-css=false --metadata lang=en -o "$html"
# Chrome is chatty on stderr; show it only if printing fails.
if ! "$chrome" --headless=new --disable-gpu --no-pdf-header-footer --allow-file-access-from-files \
  --print-to-pdf="$manual/GoalNexa-User-Manual.pdf" "file://$html" 2>"$log"; then
  cat "$log" >&2
  echo "Chrome failed to print the PDF" >&2
  exit 1
fi
echo "Wrote $manual/GoalNexa-User-Manual.pdf"
