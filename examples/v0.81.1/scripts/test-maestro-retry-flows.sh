#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/nitro-maestro-retry.XXXXXX")"

cleanup() {
  rm -rf "$TEST_ROOT"
}
trap cleanup EXIT

mkdir -p "$TEST_ROOT/bin" "$TEST_ROOT/flows"
: >"$TEST_ROOT/flows/smoke.yaml"

cat >"$TEST_ROOT/bin/maestro" <<'MAESTRO'
#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f "$FAKE_MAESTRO_STATE" ]]; then
  : >"$FAKE_MAESTRO_STATE"
  echo "Maestro Android driver did not start up in time" >&2
  exit 1
fi
MAESTRO

cat >"$TEST_ROOT/bin/adb" <<'ADB'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >>"$FAKE_ADB_LOG"
ADB

cat >"$TEST_ROOT/bin/sleep" <<'SLEEP'
#!/usr/bin/env bash
exit 0
SLEEP

chmod +x "$TEST_ROOT/bin/maestro" "$TEST_ROOT/bin/adb" "$TEST_ROOT/bin/sleep"

run_case() {
  local case_name="$1"
  local serial="$2"
  local case_dir="$TEST_ROOT/$case_name"
  local output_path="$case_dir/output.log"
  local adb_log_path="$case_dir/adb.log"
  local maestro_state_path="$case_dir/maestro.state"

  mkdir -p "$case_dir"

  if [[ -n "$serial" ]]; then
    ANDROID_SERIAL="$serial" \
      PATH="$TEST_ROOT/bin:$PATH" \
      ADB="$TEST_ROOT/bin/adb" \
      FAKE_ADB_LOG="$adb_log_path" \
      FAKE_MAESTRO_STATE="$maestro_state_path" \
      MAESTRO_INFRA_RETRIES=1 \
      MAESTRO_RETRY_RUN_DIR="$case_dir/retry-logs" \
      "$SCRIPT_DIR/maestro-retry-flows.sh" \
      --platform android \
      --flow-dir "$TEST_ROOT/flows" \
      --attempts 1 \
      --maestro "$TEST_ROOT/bin/maestro" \
      --suite-name "retry self-test" \
      -- smoke.yaml >"$output_path"
  else
    (
      unset ANDROID_SERIAL
      PATH="$TEST_ROOT/bin:$PATH" \
        ADB="$TEST_ROOT/bin/adb" \
        FAKE_ADB_LOG="$adb_log_path" \
        FAKE_MAESTRO_STATE="$maestro_state_path" \
        MAESTRO_INFRA_RETRIES=1 \
        MAESTRO_RETRY_RUN_DIR="$case_dir/retry-logs" \
        "$SCRIPT_DIR/maestro-retry-flows.sh" \
        --platform android \
        --flow-dir "$TEST_ROOT/flows" \
        --attempts 1 \
        --maestro "$TEST_ROOT/bin/maestro" \
        --suite-name "retry self-test" \
        -- smoke.yaml >"$output_path"
    )
  fi

  grep -Fq "driver recovery 1/1" "$output_path"
  grep -Fq "All Maestro retry self-test flows passed after attempt 1/1." "$output_path"
  grep -Fxq "kill-server" "$adb_log_path"
  grep -Fxq "start-server" "$adb_log_path"

  if [[ -n "$serial" ]]; then
    grep -Fxq -- "-s $serial wait-for-device" "$adb_log_path"
  else
    grep -Fxq "wait-for-device" "$adb_log_path"
  fi
}

run_case without-serial ""
run_case with-serial "emulator-5554"

echo "Maestro retry recovery self-test passed."
