#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXAMPLE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FLOW_DIR="$EXAMPLE_DIR/.maestro"

ADB_BIN="${ADB:-adb}"
MAESTRO_BIN="${MAESTRO:-maestro}"

adb_cmd() {
  if [[ -n "${ANDROID_SERIAL:-}" ]]; then
    "$ADB_BIN" -s "$ANDROID_SERIAL" "$@"
  else
    "$ADB_BIN" "$@"
  fi
}

maestro_android_test() {
  if [[ -n "${ANDROID_SERIAL:-}" ]]; then
    "$MAESTRO_BIN" test --platform android --udid "$ANDROID_SERIAL" "$@"
  else
    "$MAESTRO_BIN" test --platform android "$@"
  fi
}

set_location_enabled() {
  adb_cmd shell cmd location set-location-enabled "$1" >/dev/null
}

restore_location() {
  set_location_enabled true || true
  adb_cmd reverse --remove tcp:8081 >/dev/null 2>&1 || true
}

is_emulator() {
  [[ "$(adb_cmd shell getprop ro.kernel.qemu | tr -d '\r')" == "1" ]]
}

connected_device_count() {
  "$ADB_BIN" devices | awk 'NR > 1 && $2 == "device" { count++ } END { print count + 0 }'
}

trap restore_location EXIT

RUN_ANDROID_PROVIDER_SELECTION_VALUE="${RUN_ANDROID_PROVIDER_SELECTION:-0}"
PROVIDER_SELECTION_PHYSICAL_DEVICE_VALUE="0"

if [[ "$RUN_ANDROID_PROVIDER_SELECTION_VALUE" == "1" ]] && is_emulator; then
  echo "RUN_ANDROID_PROVIDER_SELECTION=1 requires a physical Android device." >&2
  exit 1
fi
if [[ "$RUN_ANDROID_PROVIDER_SELECTION_VALUE" == "1" && -z "${ANDROID_SERIAL:-}" && "$(connected_device_count)" != "1" ]]; then
  echo "RUN_ANDROID_PROVIDER_SELECTION=1 requires ANDROID_SERIAL when multiple Android devices are connected." >&2
  exit 1
fi
if [[ "$RUN_ANDROID_PROVIDER_SELECTION_VALUE" == "1" ]]; then
  PROVIDER_SELECTION_PHYSICAL_DEVICE_VALUE="1"
fi

adb_cmd reverse tcp:8081 tcp:8081 >/dev/null
set_location_enabled true
maestro_android_test \
  -e RUN_ANDROID_PROVIDER_SELECTION="$RUN_ANDROID_PROVIDER_SELECTION_VALUE" \
  -e PROVIDER_SELECTION_PHYSICAL_DEVICE="$PROVIDER_SELECTION_PHYSICAL_DEVICE_VALUE" \
  "$FLOW_DIR/all-tests.yaml"

set_location_enabled false
maestro_android_test "$FLOW_DIR/provider-settings-not-ready.yaml"
