#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXAMPLE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$(cd "$EXAMPLE_DIR/../.." && pwd)"
FLOW_DIR="$EXAMPLE_DIR/.maestro"

ADB_BIN="${ADB:-adb}"
MAESTRO_BIN="${MAESTRO:-maestro}"
WEB_E2E_PORT="${WEB_E2E_PORT:-4173}"

WEB_SERVER_PID=""

start_web_e2e_server() {
  (cd "$REPO_DIR" && yarn workspace react-native-nitro-geolocation-web-e2e start --port "$WEB_E2E_PORT") &
  WEB_SERVER_PID="$!"

  for _ in {1..60}; do
    if curl -fsS "http://127.0.0.1:$WEB_E2E_PORT" >/dev/null; then
      "$ADB_BIN" reverse "tcp:$WEB_E2E_PORT" "tcp:$WEB_E2E_PORT" >/dev/null
      return
    fi
    sleep 1
  done

  echo "Timed out waiting for web E2E server on port $WEB_E2E_PORT" >&2
  exit 1
}

set_location_enabled() {
  "$ADB_BIN" shell cmd location set-location-enabled "$1" >/dev/null
}

restore_location() {
  set_location_enabled true || true
  "$ADB_BIN" reverse --remove "tcp:$WEB_E2E_PORT" >/dev/null 2>&1 || true
  if [[ -n "$WEB_SERVER_PID" ]]; then
    kill "$WEB_SERVER_PID" >/dev/null 2>&1 || true
  fi
}

trap restore_location EXIT

start_web_e2e_server
set_location_enabled true
"$MAESTRO_BIN" test --platform android "$FLOW_DIR/all-tests.yaml"

set_location_enabled false
"$MAESTRO_BIN" test --platform android "$FLOW_DIR/provider-settings-not-ready.yaml"
"$MAESTRO_BIN" test --platform android "$FLOW_DIR/web-e2e-unavailable.yaml"
