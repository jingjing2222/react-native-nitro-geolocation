#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXAMPLE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FLOW_DIR="$EXAMPLE_DIR/.maestro"

MAESTRO_BIN="${MAESTRO:-maestro}"
NODE_BIN="${NODE:-node}"

IOS_FLOWS=()
while IFS= read -r flow; do
  IOS_FLOWS+=("$flow")
done < <("$NODE_BIN" "$SCRIPT_DIR/maestro-suite-flows.mjs" "$FLOW_DIR/all-tests.yaml" ios)

"$SCRIPT_DIR/maestro-retry-flows.sh" \
  --platform ios \
  --flow-dir "$FLOW_DIR" \
  --maestro "$MAESTRO_BIN" \
  -- "${IOS_FLOWS[@]}"
