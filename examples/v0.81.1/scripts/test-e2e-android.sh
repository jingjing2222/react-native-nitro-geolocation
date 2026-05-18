#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXAMPLE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FLOW_DIR="$EXAMPLE_DIR/.maestro"

ADB_BIN="${ADB:-adb}"
MAESTRO_BIN="${MAESTRO:-maestro}"

set_location_enabled() {
  "$ADB_BIN" shell cmd location set-location-enabled "$1" >/dev/null
}

restore_location() {
  set_location_enabled true || true
  "$ADB_BIN" reverse --remove tcp:8081 >/dev/null 2>&1 || true
}

trap restore_location EXIT

"$ADB_BIN" reverse tcp:8081 tcp:8081 >/dev/null
set_location_enabled true
"$MAESTRO_BIN" test --platform android "$FLOW_DIR/all-tests.yaml"

set_location_enabled false
"$MAESTRO_BIN" test --platform android "$FLOW_DIR/provider-settings-not-ready.yaml"
