#!/usr/bin/env bash
# Boot the full Aegis dev stack in one terminal:
#
#   • control-plane   → http://127.0.0.1:8000   (FastAPI, --reload)
#   • assistant       → http://127.0.0.1:8005   (FastAPI, --reload, watches .env)
#   • dashboard       → http://127.0.0.1:3000   (Next.js dev)
#
# Output is line-prefixed per service so you can follow all three at
# once. Ctrl+C cleanly tears down every child process.
#
# Usage:
#   pnpm start:all           # via root package.json
#   ./scripts/start-all.sh   # direct
#
# Optional flags:
#   --no-cp / --no-control-plane   # skip the control plane
#   --no-assistant                 # skip the assistant (e.g. no GROQ_API_KEY)
#   --no-dashboard                 # skip the dashboard
#
# Compatibility: written for macOS's default /bin/bash (3.2). No
# associative arrays, no `wait -n`, no `set -u` foot-guns with $@.

set -eo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Load .env into the environment so every spawned service inherits the
# same keys. The dashboard's Clerk middleware crashes on boot if
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is missing; the assistant's groq
# client returns 503; the control-plane can't reach Postgres. Loading
# .env here means a fresh `pnpm start:all` works against a populated
# .env without per-terminal `source`-ing.
if [ -f "$REPO_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1090,SC1091
  source "$REPO_ROOT/.env"
  set +a
  echo "▸ Loaded .env"
else
  echo "▸ No .env found — services may fail with missing-key errors. Copy .env.example → .env first."
fi

WANT_CP=1
WANT_ASSISTANT=1
WANT_DASHBOARD=1

while [ $# -gt 0 ]; do
  case "$1" in
    --no-cp|--no-control-plane) WANT_CP=0 ;;
    --no-assistant) WANT_ASSISTANT=0 ;;
    --no-dashboard) WANT_DASHBOARD=0 ;;
    -h|--help)
      grep -E '^# ' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "✘ Unknown flag: $1" >&2
      exit 1
      ;;
  esac
  shift
done

# ANSI colors per service. Plain variables instead of an assoc array
# so this works on macOS's bash 3.2.
COLOR_CP=$'\033[36m'        # cyan
COLOR_ASSISTANT=$'\033[35m' # magenta
COLOR_DASH=$'\033[33m'      # yellow
RESET=$'\033[0m'

# Track every spawned PID for clean teardown on Ctrl+C.
PIDS=""

cleanup() {
  local exit_code=$?
  echo ""
  echo "▸ Tearing down stack…"
  for pid in $PIDS; do
    if kill -0 "$pid" 2>/dev/null; then
      # Kill the whole process group so uvicorn's reloader children
      # and pnpm's spawned `next dev` also die.
      kill -- -"$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
    fi
  done
  # Final port sweep — uvicorn --reload sometimes leaves orphan
  # workers if SIGTERM races the supervisor.
  for port in 8000 8005 3000; do
    pids="$(lsof -tiTCP:"$port" 2>/dev/null || true)"
    if [ -n "$pids" ]; then
      echo "$pids" | xargs kill -9 2>/dev/null || true
    fi
  done
  echo "▸ Done."
  exit $exit_code
}
trap cleanup INT TERM EXIT

# Pre-flight port check — surface a clear error if a port is taken so
# the operator knows to kill the stale process instead of debugging
# silent boot failures.
preflight() {
  local taken=""
  if [ "$WANT_CP" = "1" ] && lsof -tiTCP:8000 >/dev/null 2>&1; then
    taken="$taken 8000(cp)"
  fi
  if [ "$WANT_ASSISTANT" = "1" ] && lsof -tiTCP:8005 >/dev/null 2>&1; then
    taken="$taken 8005(assistant)"
  fi
  if [ "$WANT_DASHBOARD" = "1" ] && lsof -tiTCP:3000 >/dev/null 2>&1; then
    taken="$taken 3000(dashboard)"
  fi
  if [ -n "$taken" ]; then
    echo "✘ Ports already in use:$taken" >&2
    echo "  Kill the existing process(es) and retry:" >&2
    echo "    lsof -tiTCP:8000,8005,3000 | xargs -r kill -9" >&2
    exit 1
  fi
}
preflight

# Stream a service's stdout+stderr through `sed` to prefix every line
# with a colored tag. Saves us from interleaving three raw firehoses.
spawn() {
  local tag="$1"
  local color="$2"
  shift 2
  local prefix
  prefix=$(printf "%s[%-9s]%s" "$color" "$tag" "$RESET")
  # Run in a new process group so cleanup can kill the whole tree.
  set -m
  ( "$@" 2>&1 | sed -u "s|^|$prefix |" ) &
  local pid=$!
  PIDS="$PIDS $pid"
  set +m
}

echo "▸ Booting Aegis stack from $REPO_ROOT"
echo ""

if [ "$WANT_CP" = "1" ]; then
  spawn "cp" "$COLOR_CP" \
    uv run --package aegis-control-plane \
    uvicorn aegis_control_plane.app:app --port 8000 --reload \
    --reload-include='*.py' --reload-include='.env' --reload-include='.env.local'
fi

if [ "$WANT_ASSISTANT" = "1" ]; then
  spawn "assistant" "$COLOR_ASSISTANT" \
    uv run --package aegis-assistant \
    uvicorn aegis_assistant.app:app --port 8005 --reload \
    --reload-include='*.py' --reload-include='.env' --reload-include='.env.local'
fi

if [ "$WANT_DASHBOARD" = "1" ]; then
  spawn "dashboard" "$COLOR_DASH" \
    pnpm --filter @aegis/dashboard dev
fi

echo "▸ All services up. Ctrl+C to stop."
echo ""

# `wait -n` is bash 4+. In bash 3.2 we wait on every child explicitly;
# the trap on INT still tears everything down on Ctrl+C.
wait $PIDS
