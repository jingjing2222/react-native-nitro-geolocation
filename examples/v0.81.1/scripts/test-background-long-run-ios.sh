#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXAMPLE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FLOW_DIR="$EXAMPLE_DIR/.maestro"

MAESTRO_BIN="${MAESTRO:-maestro}"
MAESTRO_ARGS=(--platform ios)
cleanup_flow_ran=0

if [[ -n "${IOS_UDID:-}" ]]; then
  MAESTRO_ARGS+=(--device "$IOS_UDID")
fi

finish() {
  local status=$?
  trap - EXIT
  if [[ "$cleanup_flow_ran" == "0" ]]; then
    "$MAESTRO_BIN" test "${MAESTRO_ARGS[@]}" "$FLOW_DIR/background-long-run-cleanup.yaml" || true
  fi
  exit "$status"
}

trap finish EXIT

"$MAESTRO_BIN" test "${MAESTRO_ARGS[@]}" "$FLOW_DIR/background-long-run-ios.yaml"
cleanup_flow_ran=1
"$MAESTRO_BIN" test "${MAESTRO_ARGS[@]}" "$FLOW_DIR/background-long-run-cleanup.yaml"
