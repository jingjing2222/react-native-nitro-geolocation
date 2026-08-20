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

is_emulator() {
  [[ "$(adb_cmd shell getprop ro.kernel.qemu | tr -d '\r')" == "1" ]]
}

connected_device_count() {
  "$ADB_BIN" devices | awk 'NR > 1 && $2 == "device" { count++ } END { print count + 0 }'
}

read_binary_setting() {
  local setting_name="$1"
  local value
  value="$(adb_cmd shell settings get global "$setting_name" | tr -d '\r')"

  if [[ "$value" != "0" && "$value" != "1" ]]; then
    echo "Expected Android global setting $setting_name to be 0 or 1, received '$value'." >&2
    return 1
  fi

  printf '%s' "$value"
}

wait_for_binary_setting() {
  local setting_name="$1"
  local expected="$2"
  local attempt value

  for attempt in {1..15}; do
    value="$(adb_cmd shell settings get global "$setting_name" | tr -d '\r')"
    if [[ "$value" == "$expected" ]]; then
      return 0
    fi
    sleep 1
  done

  echo "Android global setting $setting_name did not reach $expected." >&2
  return 1
}

has_validated_internet() {
  adb_cmd shell dumpsys connectivity |
    grep -Eq 'NetworkAgentInfo.*CONNECTED.*Capabilities:.*INTERNET.*VALIDATED'
}

wait_for_validated_internet_state() {
  local expected="$1"
  local _attempt
  local actual

  for _attempt in {1..15}; do
    if has_validated_internet; then
      actual="1"
    else
      actual="0"
    fi

    if [[ "$actual" == "$expected" ]]; then
      return 0
    fi
    sleep 1
  done

  echo "Android validated internet state did not reach $expected." >&2
  return 1
}

run_flow() {
  local flow="$1"
  shift

  local args=(
    --platform android
    --flow-dir "$FLOW_DIR"
    --maestro "$MAESTRO_BIN"
    --suite-name "android GPS offline recipe"
  )
  if [[ -n "${ANDROID_SERIAL:-}" ]]; then
    args+=(--maestro-arg --udid --maestro-arg "$ANDROID_SERIAL")
  fi

  "$SCRIPT_DIR/maestro-retry-flows.sh" "${args[@]}" "$@" -- "$flow"
}

if [[ -z "${ANDROID_SERIAL:-}" && "$(connected_device_count)" != "1" ]]; then
  echo "GPS offline verification requires ANDROID_SERIAL when zero or multiple Android devices are connected." >&2
  exit 1
fi

if ! is_emulator; then
  if [[ "${GPS_OFFLINE_NETWORK_PREPARED:-0}" != "1" ]]; then
    echo "Physical-device proof requires GPS_OFFLINE_NETWORK_PREPARED=1 after Wi-Fi and mobile data are disabled." >&2
    exit 1
  fi

  run_flow \
    gps-offline-physical.yaml \
    --env GPS_OFFLINE_PHYSICAL_DEVICE=1 \
    --env GPS_OFFLINE_NETWORK_PREPARED=1
  exit 0
fi

WIFI_WAS_ENABLED="$(read_binary_setting wifi_on)"
DATA_WAS_ENABLED="$(read_binary_setting mobile_data)"
wait_for_validated_internet_state 1

restore_network() {
  local restore_failed=0

  if [[ "$WIFI_WAS_ENABLED" == "0" ]]; then
    if ! adb_cmd shell svc wifi disable >/dev/null; then
      restore_failed=1
    fi
  else
    if ! adb_cmd shell svc wifi enable >/dev/null; then
      restore_failed=1
    fi
  fi

  if [[ "$DATA_WAS_ENABLED" == "0" ]]; then
    if ! adb_cmd shell svc data disable >/dev/null; then
      restore_failed=1
    fi
  else
    if ! adb_cmd shell svc data enable >/dev/null; then
      restore_failed=1
    fi
  fi

  if ! wait_for_binary_setting wifi_on "$WIFI_WAS_ENABLED"; then
    restore_failed=1
  fi
  if ! wait_for_binary_setting mobile_data "$DATA_WAS_ENABLED"; then
    restore_failed=1
  fi
  if ! wait_for_validated_internet_state 1; then
    restore_failed=1
  fi

  return "$restore_failed"
}

restore_network_on_exit() {
  local exit_code=$?
  trap - EXIT

  if ! restore_network; then
    echo "Failed to restore the Android emulator network state." >&2
    exit 1
  fi

  exit "$exit_code"
}

trap restore_network_on_exit EXIT

adb_cmd shell svc wifi disable >/dev/null
adb_cmd shell svc data disable >/dev/null
wait_for_binary_setting wifi_on 0
wait_for_binary_setting mobile_data 0
wait_for_validated_internet_state 0

run_flow \
  gps-offline-emulator.yaml \
  --env GPS_OFFLINE_NETWORK_DISABLED=1
