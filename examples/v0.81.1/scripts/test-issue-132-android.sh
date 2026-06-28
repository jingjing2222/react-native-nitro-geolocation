#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXAMPLE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ANDROID_DIR="$EXAMPLE_DIR/android"

ADB_BIN="${ADB:-adb}"
AGENT_DEVICE_BIN="${AGENT_DEVICE:-agent-device}"
AGENT_DEVICE_ARGS=(--platform android)
if [[ -n "${ANDROID_SERIAL:-}" ]]; then
  AGENT_DEVICE_ARGS+=(--serial "$ANDROID_SERIAL")
fi

adb_device() {
  if [[ -n "${ANDROID_SERIAL:-}" ]]; then
    "$ADB_BIN" -s "$ANDROID_SERIAL" "$@"
  else
    "$ADB_BIN" "$@"
  fi
}

agent_device() {
  "$AGENT_DEVICE_BIN" "$@" "${AGENT_DEVICE_ARGS[@]}"
}

EXPECT_WARNING="${EXPECT_WARNING:-0}"
LOG_FILE="${LOG_FILE:-$ANDROID_DIR/build/reports/issue-132-logcat.txt}"
WARNING_PATTERN="No task registered for key NitroBackgroundLocationTask"
APK_PATH="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
SESSION_NAME="${AGENT_DEVICE_SESSION:-issue132}"

cleanup() {
  "$AGENT_DEVICE_BIN" --session "$SESSION_NAME" close >/dev/null 2>&1 || true
  adb_device shell am force-stop nitrogeolocation.example >/dev/null 2>&1 || true
  adb_device shell cmd location set-location-enabled true >/dev/null 2>&1 || true
}

trap cleanup EXIT

cd "$ANDROID_DIR"
ENTRY_FILE=index.no-headless.js ./gradlew :app:assembleRelease \
  --no-daemon \
  --console=plain \
  -PreactNativeArchitectures="${REACT_NATIVE_ARCHITECTURES:-arm64-v8a}"

adb_device install -r "$APK_PATH" >/dev/null
adb_device shell cmd location set-location-enabled true >/dev/null
adb_device shell pm grant nitrogeolocation.example android.permission.ACCESS_FINE_LOCATION >/dev/null 2>&1 || true
adb_device shell pm grant nitrogeolocation.example android.permission.ACCESS_COARSE_LOCATION >/dev/null 2>&1 || true
adb_device shell pm grant nitrogeolocation.example android.permission.ACCESS_BACKGROUND_LOCATION >/dev/null 2>&1 || true
adb_device shell pm grant nitrogeolocation.example android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || true
adb_device logcat -c
mkdir -p "$(dirname "$LOG_FILE")"

if [[ "$(adb_device shell getprop ro.kernel.qemu | tr -d '\r')" != "1" ]]; then
  echo "Issue 132 E2E requires an Android emulator because it injects locations with adb emu geo fix." >&2
  exit 1
fi

agent_device --session "$SESSION_NAME" --session-lock strip open nitrogeolocation://app/issue-132 >/dev/null
agent_device --session "$SESSION_NAME" press 'id="issue-132-start-button"' >/dev/null
adb_device emu geo fix 126.978 37.5665 >/dev/null
sleep 15
adb_device emu geo fix 126.979 37.567 >/dev/null

ui_passed=0
for _ in $(seq 1 30); do
  if agent_device --session "$SESSION_NAME" snapshot 2>/dev/null | grep -Fq "Foreground listener: passed"; then
    ui_passed=1
    break
  fi
  sleep 1
done

agent_device --session "$SESSION_NAME" press 'id="issue-132-cleanup-button"' >/dev/null 2>&1 || true

if [[ "$ui_passed" != "1" ]]; then
  echo "Issue 132 E2E failed: foreground listener did not receive a location update." >&2
  agent_device --session "$SESSION_NAME" snapshot >&2 || true
  exit 1
fi

adb_device logcat -d -v time > "$LOG_FILE"

if grep -Fq "$WARNING_PATTERN" "$LOG_FILE"; then
  if [[ "$EXPECT_WARNING" == "1" ]]; then
    echo "Issue 132 warning reproduced: $WARNING_PATTERN"
    exit 0
  fi
  echo "Issue 132 regression: unexpected warning found in $LOG_FILE" >&2
  exit 1
fi

if [[ "$EXPECT_WARNING" == "1" ]]; then
  echo "Issue 132 warning was expected but not found in $LOG_FILE" >&2
  exit 1
fi

echo "Issue 132 green: no Headless JS task warning found."
