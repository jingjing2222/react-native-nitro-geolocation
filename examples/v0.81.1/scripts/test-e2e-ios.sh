#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXAMPLE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FLOW_DIR="$EXAMPLE_DIR/.maestro"

MAESTRO_BIN="${MAESTRO:-maestro}"
NODE_BIN="${NODE:-node}"

if ! ios_flow_output="$(
  "$NODE_BIN" "$SCRIPT_DIR/maestro-suite-flows.mjs" "$FLOW_DIR/all-tests.yaml" ios
)"; then
  echo "Failed to discover ios Maestro flows." >&2
  exit 1
fi

if [[ -z "$ios_flow_output" ]]; then
  echo "No ios Maestro flows were discovered." >&2
  exit 1
fi

IOS_FLOWS=()
while IFS= read -r flow; do
  IOS_FLOWS+=("$flow")
done <<<"$ios_flow_output"

DEVICE_ARGS=()
if [[ -n "${IOS_UDID:-}" ]]; then
  DEVICE_ARGS+=(--maestro-arg --device --maestro-arg "$IOS_UDID")
fi

"$SCRIPT_DIR/maestro-retry-flows.sh" \
  --platform ios \
  --flow-dir "$FLOW_DIR" \
  --maestro "$MAESTRO_BIN" \
  --suite-name "ios" \
  "${DEVICE_ARGS[@]}" \
  -- "${IOS_FLOWS[@]}"
