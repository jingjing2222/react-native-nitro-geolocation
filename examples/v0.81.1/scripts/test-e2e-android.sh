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

COMMON_FLOWS=(
  current-position.yaml
  watch-position.yaml
  location-simulation.yaml
  accuracy-presets.yaml
  last-known-position.yaml
  geocoding.yaml
  location-availability.yaml
  heading.yaml
)

ANDROID_FLOWS=(
  issue-119-android.yaml
  issue-120-android.yaml
  issue-121-android.yaml
  issue-122-android.yaml
  permission-check.yaml
  android-request-options.yaml
  "${COMMON_FLOWS[@]}"
  issue-67-android-coarse-location.yaml
  provider-settings.yaml
  background-e2e.yaml
  mocked-metadata-android-true.yaml
  api-errors.yaml
  compat-api.yaml
)

if [[ "$RUN_ANDROID_PROVIDER_SELECTION_VALUE" == "1" ]]; then
  ANDROID_FLOWS=(
    "${ANDROID_FLOWS[@]:0:5}"
    android-provider-selection.yaml
    "${ANDROID_FLOWS[@]:5}"
  )
fi

run_maestro_flows() {
  local maestro_extra_args=()
  local arg
  for arg in "${MAESTRO_DEVICE_ARGS[@]}"; do
    maestro_extra_args+=(--maestro-arg "$arg")
  done

  "$SCRIPT_DIR/maestro-retry-flows.sh" \
    --platform android \
    --flow-dir "$FLOW_DIR" \
    --maestro "$MAESTRO_BIN" \
    "${maestro_extra_args[@]}" \
    --env "RUN_ANDROID_PROVIDER_SELECTION=$RUN_ANDROID_PROVIDER_SELECTION_VALUE" \
    --env "PROVIDER_SELECTION_PHYSICAL_DEVICE=$PROVIDER_SELECTION_PHYSICAL_DEVICE_VALUE" \
    -- "$@"
}

"$ADB_BIN" "${ADB_DEVICE_ARGS[@]}" reverse tcp:8081 tcp:8081 >/dev/null
status=0

set_location_enabled true
run_maestro_flows "${ANDROID_FLOWS[@]}" || status=1

set_location_enabled false
run_maestro_flows provider-settings-not-ready.yaml || status=1

exit "$status"
