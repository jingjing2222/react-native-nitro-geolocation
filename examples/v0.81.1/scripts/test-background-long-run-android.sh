#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXAMPLE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FLOW_DIR="$EXAMPLE_DIR/.maestro"

ADB_BIN="${ADB:-adb}"
MAESTRO_BIN="${MAESTRO:-maestro}"
RUN_REBOOT="${RUN_REBOOT:-0}"

MAESTRO_ARGS=(--platform android)

if [[ -n "${ANDROID_SERIAL:-}" ]]; then
  MAESTRO_ARGS+=(--device "$ANDROID_SERIAL")
fi

adb_device() {
  if [[ -n "${ANDROID_SERIAL:-}" ]]; then
    "$ADB_BIN" -s "$ANDROID_SERIAL" "$@"
  else
    "$ADB_BIN" "$@"
  fi
}

set_android_location_enabled() {
  adb_device shell cmd location set-location-enabled "$1" >/dev/null
}

set_emulator_location() {
  local latitude="$1"
  local longitude="$2"
  if ! adb_device emu geo fix "$longitude" "$latitude" >/dev/null; then
    echo "Android long-run reboot check requires an emulator that accepts 'adb emu geo fix'." >&2
    exit 1
  fi
}

require_android_emulator() {
  local is_emulator
  is_emulator="$(adb_device shell getprop ro.kernel.qemu | tr -d '\r')"
  if [[ "$is_emulator" != "1" ]]; then
    echo "RUN_REBOOT=1 is emulator-only. Refusing to reboot a physical Android device." >&2
    exit 1
  fi
  set_emulator_location 37.563 126.970
}

restore_location() {
  set_android_location_enabled true || true
}

trap restore_location EXIT

set_android_location_enabled true
"$MAESTRO_BIN" test "${MAESTRO_ARGS[@]}" "$FLOW_DIR/background-long-run-android.yaml"

if [[ "$RUN_REBOOT" == "1" ]]; then
  require_android_emulator
  "$MAESTRO_BIN" test "${MAESTRO_ARGS[@]}" "$FLOW_DIR/background-long-run-android-arm-reboot.yaml"
  adb_device reboot
  adb_device wait-for-device
  sleep 30
  set_android_location_enabled true
  adb_device shell input keyevent 82 >/dev/null 2>&1 || true
  set_emulator_location 37.563 126.970
  sleep 10
  set_emulator_location 37.5665 126.978
  sleep 20
  set_emulator_location 37.563 126.970
  sleep 20
  "$MAESTRO_BIN" test "${MAESTRO_ARGS[@]}" "$FLOW_DIR/background-long-run-android-reboot.yaml"
fi
