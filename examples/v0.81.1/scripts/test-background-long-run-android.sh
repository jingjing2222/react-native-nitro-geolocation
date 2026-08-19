#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXAMPLE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FLOW_DIR="$EXAMPLE_DIR/.maestro"

ADB_BIN="${ADB:-adb}"
MAESTRO_BIN="${MAESTRO:-maestro}"
RUN_REBOOT="${RUN_REBOOT:-0}"
cleanup_flow_armed=0
cleanup_flow_ran=0

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

stop_emulator_settings() {
  # The API 34 test image can leave Settings in an ANR state after the permission
  # handoff. Its system dialog obscures assertions even though the app proof passed.
  if [[ "$(adb_device shell getprop ro.kernel.qemu | tr -d '\r')" != "1" ]]; then
    return
  fi
  adb_device shell am force-stop com.android.settings >/dev/null 2>&1 || true
}

finish() {
  local status=$?
  trap - EXIT
  restore_location
  if [[ "$cleanup_flow_armed" == "1" && "$cleanup_flow_ran" == "0" ]]; then
    "$MAESTRO_BIN" test "${MAESTRO_ARGS[@]}" "$FLOW_DIR/background-long-run-cleanup.yaml" || true
  fi
  exit "$status"
}

trap finish EXIT

set_android_location_enabled true
cleanup_flow_armed=1
"$MAESTRO_BIN" test "${MAESTRO_ARGS[@]}" "$FLOW_DIR/background-long-run-android.yaml"
stop_emulator_settings

if [[ "$RUN_REBOOT" == "1" ]]; then
  require_android_emulator
  "$MAESTRO_BIN" test "${MAESTRO_ARGS[@]}" "$FLOW_DIR/background-long-run-android-arm-reboot.yaml"
  adb_device reboot
  adb_device wait-for-device
  boot_completed=""
  for _ in {1..600}; do
    boot_completed="$(adb_device shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" ||
      boot_completed=""
    if [[ "$boot_completed" == "1" ]]; then
      break
    fi
    sleep 1
  done
  if [[ "$boot_completed" != "1" ]]; then
    echo "Android did not report sys.boot_completed=1 within 10 minutes." >&2
    exit 1
  fi
  set_android_location_enabled true
  stop_emulator_settings
  adb_device shell input keyevent 82 >/dev/null 2>&1 || true
  # The persisted proof marker is 15 seconds ahead of the arm action so that
  # pre-reboot callbacks cannot satisfy the reboot gate.
  sleep 15
  "$MAESTRO_BIN" test "${MAESTRO_ARGS[@]}" "$FLOW_DIR/background-long-run-android-reboot-drive.yaml"
  "$MAESTRO_BIN" test "${MAESTRO_ARGS[@]}" "$FLOW_DIR/background-long-run-android-reboot.yaml"
fi

cleanup_flow_ran=1
"$MAESTRO_BIN" test "${MAESTRO_ARGS[@]}" "$FLOW_DIR/background-long-run-cleanup.yaml"
