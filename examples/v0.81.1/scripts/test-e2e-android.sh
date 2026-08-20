#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXAMPLE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FLOW_DIR="$EXAMPLE_DIR/.maestro"

ADB_BIN="${ADB:-adb}"
MAESTRO_BIN="${MAESTRO:-maestro}"
NODE_BIN="${NODE:-node}"
DISABLED_LAUNCHER_PACKAGE=""
EXAMPLE_APP_ID="nitrogeolocation.example"
LOCATION_PERMISSIONS=(
  android.permission.ACCESS_FINE_LOCATION
  android.permission.ACCESS_COARSE_LOCATION
)

adb_cmd() {
  if [[ -n "${ANDROID_SERIAL:-}" ]]; then
    "$ADB_BIN" -s "$ANDROID_SERIAL" "$@"
  else
    "$ADB_BIN" "$@"
  fi
}

set_location_enabled() {
  adb_cmd shell cmd location set-location-enabled "$1" >/dev/null
}

clear_location_permission_flags() {
  local permission
  for permission in "${LOCATION_PERMISSIONS[@]}"; do
    adb_cmd shell pm clear-permission-flags \
      --user 0 \
      "$EXAMPLE_APP_ID" \
      "$permission" \
      user-set user-fixed >/dev/null 2>&1 || true
  done
}

set_location_permission_permanently_denied() {
  local permission
  for permission in "${LOCATION_PERMISSIONS[@]}"; do
    adb_cmd shell pm revoke \
      --user 0 \
      "$EXAMPLE_APP_ID" \
      "$permission" >/dev/null 2>&1 || true
    adb_cmd shell pm set-permission-flags \
      --user 0 \
      "$EXAMPLE_APP_ID" \
      "$permission" \
      user-set user-fixed >/dev/null
  done
}

prepare_provider_watcher_permissions() {
  adb_cmd shell am force-stop "$EXAMPLE_APP_ID" >/dev/null
  adb_cmd shell pm clear "$EXAMPLE_APP_ID" >/dev/null
  adb_cmd shell pm grant \
    "$EXAMPLE_APP_ID" android.permission.ACCESS_COARSE_LOCATION
  adb_cmd shell pm grant \
    "$EXAMPLE_APP_ID" android.permission.ACCESS_FINE_LOCATION
  adb_cmd shell pm revoke \
    "$EXAMPLE_APP_ID" android.permission.ACCESS_BACKGROUND_LOCATION \
    >/dev/null 2>&1 || true
}

grant_background_permission_and_pause_host() {
  adb_cmd shell pm grant \
    "$EXAMPLE_APP_ID" android.permission.ACCESS_BACKGROUND_LOCATION
  adb_cmd shell am start \
    -a android.settings.APPLICATION_DETAILS_SETTINGS \
    -d "package:$EXAMPLE_APP_ID" >/dev/null
}

disable_emulator_launcher() {
  if ! is_emulator; then
    return
  fi

  local launcher_package
  launcher_package="$(
    adb_cmd shell cmd package resolve-activity --brief \
      -a android.intent.action.MAIN \
      -c android.intent.category.HOME 2>/dev/null |
      tr -d '\r' |
      awk -F/ 'NF > 1 { package = $1 } END { print package }'
  )"

  if [[ -z "$launcher_package" ||
    "$launcher_package" == "android" ||
    "$launcher_package" == "com.android.settings" ]]; then
    return
  fi

  if adb_cmd shell pm disable-user --user 0 "$launcher_package" >/dev/null 2>&1; then
    DISABLED_LAUNCHER_PACKAGE="$launcher_package"
    echo "Disabled emulator launcher package to avoid launcher ANR dialogs: $launcher_package"
  fi
}

restore_emulator_launcher() {
  if [[ -n "$DISABLED_LAUNCHER_PACKAGE" ]]; then
    adb_cmd shell pm enable "$DISABLED_LAUNCHER_PACKAGE" >/dev/null 2>&1 || true
    DISABLED_LAUNCHER_PACKAGE=""
  fi
}

restore_location() {
  restore_emulator_launcher
  clear_location_permission_flags
  set_location_enabled true || true
  adb_cmd reverse --remove tcp:8081 >/dev/null 2>&1 || true
}

restore_location_on_exit() {
  local status=$?
  trap - EXIT
  restore_location
  exit "$status"
}

is_emulator() {
  [[ "$(adb_cmd shell getprop ro.kernel.qemu | tr -d '\r')" == "1" ]]
}

connected_device_count() {
  "$ADB_BIN" devices | awk 'NR > 1 && $2 == "device" { count++ } END { print count + 0 }'
}

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

LOCATION_WAS_ENABLED="$(
  adb_cmd shell cmd location is-location-enabled | tr -d '\r'
)"
if [[ "$LOCATION_WAS_ENABLED" != "true" && "$LOCATION_WAS_ENABLED" != "false" ]]; then
  echo "Unable to capture the initial Android location-services state." >&2
  exit 1
fi

trap restore_location_on_exit EXIT

if ! android_flow_output="$(
  "$NODE_BIN" "$SCRIPT_DIR/maestro-suite-flows.mjs" "$FLOW_DIR/all-tests.yaml" android
)"; then
  echo "Failed to discover android Maestro flows." >&2
  exit 1
fi

if [[ -z "$android_flow_output" ]]; then
  echo "No android Maestro flows were discovered." >&2
  exit 1
fi

ANDROID_FLOWS=()
while IFS= read -r flow; do
  ANDROID_FLOWS+=("$flow")
done <<<"$android_flow_output"

run_maestro_flows() {
  local suite_name="$1"
  shift

  local retry_args=(
    --platform android
    --flow-dir "$FLOW_DIR"
    --maestro "$MAESTRO_BIN"
    --suite-name "$suite_name"
  )
  if [[ -n "${ANDROID_SERIAL:-}" ]]; then
    retry_args+=(--maestro-arg --udid --maestro-arg "$ANDROID_SERIAL")
  fi

  retry_args+=( \
    --env "RUN_ANDROID_PROVIDER_SELECTION=$RUN_ANDROID_PROVIDER_SELECTION_VALUE" \
    --env "PROVIDER_SELECTION_PHYSICAL_DEVICE=$PROVIDER_SELECTION_PHYSICAL_DEVICE_VALUE" \
    -- "$@" \
  )

  "$SCRIPT_DIR/maestro-retry-flows.sh" "${retry_args[@]}"
}

adb_cmd reverse tcp:8081 tcp:8081 >/dev/null
disable_emulator_launcher
status=0

set_location_enabled true
run_maestro_flows "android location-enabled" "${ANDROID_FLOWS[@]}" || status=1
run_maestro_flows \
  "android GPS stale-readiness setup" \
  gps-only-recipe-stale-readiness-prepare.yaml || status=1
set_location_enabled false
run_maestro_flows \
  "android GPS stale-readiness verification" \
  gps-only-recipe-stale-readiness-verify.yaml || status=1
set_location_enabled true

set_location_permission_permanently_denied
run_maestro_flows \
  "android permanently-denied permission" \
  location-readiness-permanently-denied.yaml || status=1
clear_location_permission_flags

prepare_provider_watcher_permissions
run_maestro_flows \
  "android provider watcher started" \
  provider-status-watcher-android-start.yaml || status=1
grant_background_permission_and_pause_host
run_maestro_flows \
  "android provider watcher resumed" \
  provider-status-watcher-android-resumed.yaml || status=1
set_location_enabled false
run_maestro_flows \
  "android provider watcher changed" \
  provider-status-watcher-android-changed.yaml || status=1
set_location_enabled true
run_maestro_flows \
  "android provider watcher stopped" \
  provider-status-watcher-android-stopped.yaml || status=1

set_location_enabled false
run_maestro_flows \
  "android location-disabled" \
  provider-settings-not-ready.yaml \
  location-readiness-disabled.yaml \
  gps-only-recipe-not-ready.yaml || status=1

exit "$status"
