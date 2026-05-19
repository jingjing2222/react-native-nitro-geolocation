#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXAMPLE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FLOW_DIR="$EXAMPLE_DIR/.maestro"

ADB_BIN="${ADB:-adb}"
MAESTRO_BIN="${MAESTRO:-maestro}"
ADB_DEVICE_ARGS=()
if [[ -n "${ANDROID_SERIAL:-}" ]]; then
  ADB_DEVICE_ARGS=(-s "$ANDROID_SERIAL")
fi

set_location_enabled() {
  "$ADB_BIN" "${ADB_DEVICE_ARGS[@]}" shell cmd location set-location-enabled "$1" >/dev/null
}

restore_location() {
  set_location_enabled true || true
  "$ADB_BIN" "${ADB_DEVICE_ARGS[@]}" reverse --remove tcp:8081 >/dev/null 2>&1 || true
}

is_emulator() {
  [[ "$("$ADB_BIN" "${ADB_DEVICE_ARGS[@]}" shell getprop ro.kernel.qemu | tr -d '\r')" == "1" ]]
}

connected_device_count() {
  "$ADB_BIN" devices | awk 'NR > 1 && $2 == "device" { count++ } END { print count + 0 }'
}

trap restore_location EXIT

RUN_ANDROID_PROVIDER_SELECTION_VALUE="${RUN_ANDROID_PROVIDER_SELECTION:-0}"
PROVIDER_SELECTION_PHYSICAL_DEVICE_VALUE="0"
MAESTRO_DEVICE_ARGS=()
if [[ -n "${ANDROID_SERIAL:-}" ]]; then
  MAESTRO_DEVICE_ARGS=(--udid "$ANDROID_SERIAL")
fi

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

"$ADB_BIN" "${ADB_DEVICE_ARGS[@]}" reverse tcp:8081 tcp:8081 >/dev/null
set_location_enabled true
"$MAESTRO_BIN" test --platform android \
  "${MAESTRO_DEVICE_ARGS[@]}" \
  -e RUN_ANDROID_PROVIDER_SELECTION="$RUN_ANDROID_PROVIDER_SELECTION_VALUE" \
  -e PROVIDER_SELECTION_PHYSICAL_DEVICE="$PROVIDER_SELECTION_PHYSICAL_DEVICE_VALUE" \
  "$FLOW_DIR/all-tests.yaml"

set_location_enabled false
"$MAESTRO_BIN" test --platform android \
  "${MAESTRO_DEVICE_ARGS[@]}" \
  "$FLOW_DIR/provider-settings-not-ready.yaml"
