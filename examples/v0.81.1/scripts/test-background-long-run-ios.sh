#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXAMPLE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FLOW_DIR="$EXAMPLE_DIR/.maestro"

MAESTRO_BIN="${MAESTRO:-maestro}"
MAESTRO_ARGS=(--platform ios)

if [[ -n "${IOS_UDID:-}" ]]; then
  MAESTRO_ARGS+=(--device "$IOS_UDID")
fi

"$MAESTRO_BIN" test "${MAESTRO_ARGS[@]}" "$FLOW_DIR/background-long-run-ios.yaml"
