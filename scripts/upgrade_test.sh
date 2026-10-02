#!/usr/bin/env bash
# Upgrade test: an install of an older release, with data in it, upgraded
# to this checkout - the path every self-hoster takes on `git pull`.
#
#   scripts/upgrade_test.sh <checkout of the old release> [this checkout]
#
# 1. The old release: install, migrate, serve, seed the demo account
#    (its own scripts/seed_demo.py), snapshot what the API returns.
# 2. This release on the same database: migrate, `check`, serve, verify
#    the snapshot (scripts/upgrade_check.py) and write a check-in.
# 3. This release's test suite.
#
# CI runs it against Postgres from the release named in
# .github/upgrade-from (ci.yml's `upgrade` job). Locally:
#
#   git worktree add /tmp/goalnexa-old "$(cat .github/upgrade-from)"
#   git -C /tmp/goalnexa-old submodule update --init
#   scripts/upgrade_test.sh /tmp/goalnexa-old
#
# DATABASE_URL: the database to upgrade (default: a scratch SQLite file).
# PORT (default 8765), PYTHON (default python3), SKIP_SUITE=1 to stop
# after step 2.
set -euo pipefail

OLD=$(cd "${1:?usage: scripts/upgrade_test.sh <old checkout> [new checkout]}" && pwd)
NEW=$(cd "${2:-$(dirname "$0")/..}" && pwd)
PORT=${PORT:-8765}
PYTHON=${PYTHON:-python3}
WORK=$(mktemp -d)
export DATABASE_URL=${DATABASE_URL:-sqlite:///$WORK/upgrade.sqlite3}
# Development defaults for everything else: the servers answer localhost only.
export DJANGO_DEBUG=true DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,testserver
SERVER_PID=

stop_server() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
    SERVER_PID=
  fi
}
trap 'stop_server; rm -rf "$WORK"' EXIT

# A venv with one checkout's backend and modules, as README's "without Docker".
install() { # <checkout> <venv>
  "$PYTHON" -m venv "$2"
  local modules=()
  for module in platform-core platform-auth platform-org goalnexa platform-mcp; do
    [ -d "$1/apps/$module/backend" ] && modules+=(-e "$1/apps/$module/backend")
  done
  "$2/bin/pip" install -q --disable-pip-version-check -r "$1/apps/main/backend/requirements.txt" "${modules[@]}"
}

manage() { # <checkout> <venv> <args...>
  (cd "$1/apps/main/backend" && "$2/bin/python" manage.py "${@:3}")
}

serve() { # <checkout> <venv>
  (cd "$1/apps/main/backend" && exec "$2/bin/python" manage.py runserver "127.0.0.1:$PORT" --noreload) >"$WORK/server.log" 2>&1 &
  SERVER_PID=$!
  for _ in $(seq 1 60); do
    if curl -fs -o /dev/null "http://127.0.0.1:$PORT/api/v1/auth/setup"; then return 0; fi
    kill -0 "$SERVER_PID" 2>/dev/null || break
    sleep 1
  done
  echo "The server didn't come up:"; cat "$WORK/server.log"; return 1
}

echo "== 1/3 Old release: $(git -C "$OLD" describe --tags --always 2>/dev/null || echo "$OLD")"
install "$OLD" "$WORK/old"
manage "$OLD" "$WORK/old" migrate -v 0
manage "$OLD" "$WORK/old" createcachetable
serve "$OLD" "$WORK/old"
"$PYTHON" "$OLD/scripts/seed_demo.py" --url "http://127.0.0.1:$PORT" >/dev/null
"$PYTHON" "$NEW/scripts/upgrade_check.py" snapshot "$WORK/snapshot.json" --url "http://127.0.0.1:$PORT"
stop_server

echo "== 2/3 Upgrade to: $(git -C "$NEW" describe --tags --always --dirty 2>/dev/null || echo "$NEW")"
install "$NEW" "$WORK/new"
manage "$NEW" "$WORK/new" migrate -v 0
manage "$NEW" "$WORK/new" createcachetable
manage "$NEW" "$WORK/new" check
serve "$NEW" "$WORK/new"
"$PYTHON" "$NEW/scripts/upgrade_check.py" verify "$WORK/snapshot.json" --url "http://127.0.0.1:$PORT"
stop_server

if [ -n "${SKIP_SUITE:-}" ]; then
  echo "== 3/3 Test suite: skipped"
else
  echo "== 3/3 Test suite"
  manage "$NEW" "$WORK/new" test tests platform_auth platform_org goalnexa platform_mcp
fi
echo "Upgrade test passed."
