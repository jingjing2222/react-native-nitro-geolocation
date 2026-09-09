#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FLOW_DIR="$SCRIPT_DIR/../.maestro"
ADB_BIN="${ADB:-adb}"
MAESTRO_BIN="${MAESTRO:-maestro}"
NODE_BIN="${NODE:-node}"
OUTPUT_DIR="${NOTIFICATION_ACTION_OUTPUT_DIR:-$(mktemp -d /tmp/nitro-notification-actions.XXXXXX)}"
mkdir -p "$OUTPUT_DIR"
DEVICE_XML="/sdcard/nitro-notification-actions-ui.xml"

adb_device() {
  if [[ -n "${ANDROID_SERIAL:-}" ]]; then
    "$ADB_BIN" -s "$ANDROID_SERIAL" "$@"
  else
    "$ADB_BIN" "$@"
  fi
}

run_flow() {
  local flow="$1"
  local device_args=()
  if [[ -n "${ANDROID_SERIAL:-}" ]]; then
    device_args+=(--udid "$ANDROID_SERIAL")
  fi
  "$MAESTRO_BIN" "${device_args[@]}" test --format JUNIT \
    --output "$OUTPUT_DIR/$flow.xml" \
    --test-output-dir "$OUTPUT_DIR/$flow" "$FLOW_DIR/$flow.yaml"
}

ui_center() {
  local attempt coordinates
  # Android can defer displaying a new foreground-service notification. Read
  # fresh hierarchies until the actual label is present before targeting it.
  for attempt in {1..10}; do
    if [[ "$1" == "Background tracking active" ]]; then
      adb_device shell cmd statusbar expand-notifications
    fi
    adb_device shell uiautomator dump "$DEVICE_XML" >/dev/null
    if coordinates="$(adb_device exec-out cat "$DEVICE_XML" |
      "$NODE_BIN" "$SCRIPT_DIR/android-ui-text-center.mjs" "$1" 2>/dev/null)"; then
      printf '%s\n' "$coordinates"
      return
    fi
    sleep 1
  done
  echo "Timed out waiting for notification UI label: $1" >&2
  return 1
}

tap_notification_action() {
  local title_x title_y action_x action_y coordinates
  adb_device shell cmd statusbar expand-notifications
  coordinates="$(ui_center "Background tracking active")"
  read -r title_x title_y <<< "$coordinates"
  # Expand the observed LOW-importance card, independent of other notifications.
  adb_device shell input swipe "$title_x" "$title_y" "$title_x" "$SWIPE_END_Y" 500
  coordinates="$(ui_center "$1")"
  read -r action_x action_y <<< "$coordinates"
  adb_device shell input tap "$action_x" "$action_y"
  adb_device shell cmd statusbar collapse
}

cleanup() {
  adb_device shell cmd statusbar collapse >/dev/null 2>&1 || true
  adb_device shell rm -f "$DEVICE_XML" >/dev/null 2>&1 || true
}
trap cleanup EXIT

SCREEN_HEIGHT="$(adb_device shell wm size | tr -d '\r' | sed -n 's/.*: [0-9]*x\([0-9]*\)/\1/p' | tail -1)"
if [[ ! "$SCREEN_HEIGHT" =~ ^[0-9]+$ ]]; then
  echo "Cannot determine Android screen height." >&2
  exit 1
fi
SWIPE_END_Y=$((SCREEN_HEIGHT * 9 / 10))

adb_device shell cmd statusbar collapse
run_flow notification-actions-android
tap_notification_action "Mark E2E checkpoint"
tap_notification_action "Pause E2E action"
run_flow notification-actions-android-verify
tap_notification_action "Stop E2E tracking"
run_flow notification-actions-android-stopped
echo "Notification action UI, live/stored delivery, and native Stop passed. Artifacts: $OUTPUT_DIR"
