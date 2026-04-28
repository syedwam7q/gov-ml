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
#   --no-assistant           # skip the assistant (e.g. no GROQ_API_KEY)
#   --no-dashboard           # skip the dashboard

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

WANT_CP=1
WANT_ASSISTANT=1
WANT_DASHBOARD=1

for arg in "$@"; do
  case "$arg" in
    --no-cp|--no-control-plane) WANT_CP=0 ;;
    --no-assistant) WANT_ASSISTANT=0 ;;
    --no-dashboard) WANT_DASHBOARD=0 ;;
    -h|--help)
      grep -E '^# ' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) ;;
  esac
done

# ANSI colors per service so log prefixes pop in the terminal.
declare -A COLOR=(
  [cp]=$'\033[36m'        # cyan
  [assistant]=$'\033[35m' # magenta
  [dashboard]=$'\033[33m' # yellow
)
RESET=$'\033[0m'

# Track every spawned PID for clean teardown on Ctrl+C.
PIDS=()

cleanup() {
  local exit_code=$?
  echo ""
  echo "▸ Tearing down stack…"
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      # Kill the whole process group so uvicorn's reloader children
      # and pnpm's spawned `next dev` also die.
      kill -- -"$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
    fi
  done
  # Final port sweep — uvicorn --reload sometimes leaves orphan
  # workers if SIGTERM races the supervisor.
  for port in 8000 8005 3000; do
    lsof -tiTCP:"$port" 2>/dev/null | xargs -r kill -9 2>/dev/null || true
  done
  echo "▸ Done."
  exit $exit_code
}
trap cleanup INT TERM EXIT

# Pre-flight port check — surface a clear error if a port is taken so
# the operator knows to kill the stale process instead of debugging
# silent boot failures.
preflight() {
  local taken=()
  if [[ $WANT_CP == 1 ]] && lsof -tiTCP:8000 >/dev/null 2>&1; then
    taken+=("8000 (control-plane)")
  fi
  if [[ $WANT_ASSISTANT == 1 ]] && lsof -tiTCP:8005 >/dev/null 2>&1; then
    taken+=("8005 (assistant)")
  fi
  if [[ $WANT_DASHBOARD == 1 ]] && lsof -tiTCP:3000 >/dev/null 2>&1; then
    taken+=("3000 (dashboard)")
  fi
  if [[ ${#taken[@]} -gt 0 ]]; then
    echo "✘ Ports already in use: ${taken[*]}"
    echo "  Stop the existing process(es) and retry:"
    echo "    lsof -tiTCP:8000,8005,3000 | xargs -r kill -9"
    exit 1
  fi
}
preflight

# Stream a service's stdout+stderr through `sed` to prefix every line
# with a colored tag. Saves us from interleaving three raw firehoses.
spawn() {
  local tag="$1"
  shift
  local color="${COLOR[$tag]}"
  local prefix
  printf -v prefix "%s[%-9s]%s" "$color" "$tag" "$RESET"
  # Run in a new process group so cleanup can kill the whole tree.
  set -m
  ( "$@" 2>&1 | sed -u "s|^|$prefix |" ) &
  PIDS+=("$!")
  set +m
}

echo "▸ Booting Aegis stack from $REPO_ROOT"
echo ""

if [[ $WANT_CP == 1 ]]; then
  spawn cp uv run --package aegis-control-plane \
    uvicorn aegis_control_plane.app:app --port 8000 --reload \
    --reload-include='*.py' --reload-include='*.env'
fi

if [[ $WANT_ASSISTANT == 1 ]]; then
  spawn assistant uv run --package aegis-assistant \
    uvicorn aegis_assistant.app:app --port 8005 --reload \
    --reload-include='*.py' --reload-include='*.env'
fi

if [[ $WANT_DASHBOARD == 1 ]]; then
  spawn dashboard pnpm --filter @aegis/dashboard dev
fi

echo "▸ All services up. Ctrl+C to stop."
echo ""

# Wait on every child. If any service exits (crash or normal),
# `wait -n` returns and the trap tears the rest down.
wait -n "${PIDS[@]}"
