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

if [[ "$*" == "shell cmd location is-location-enabled" ]]; then
  printf 'true\n'
fi
ADB

cat >"$TEST_ROOT/bin/sleep" <<'SLEEP'
#!/usr/bin/env bash
exit 0
SLEEP

cat >"$TEST_ROOT/bin/node" <<'NODE'
#!/usr/bin/env bash
set -euo pipefail

case "$FAKE_NODE_SCENARIO" in
  parser-error)
    echo "heading.yaml"
    echo "Synthetic Maestro suite parser failure" >&2
    exit 23
    ;;
  empty)
    exit 0
    ;;
  *)
    echo "Unknown fake Node scenario: $FAKE_NODE_SCENARIO" >&2
    exit 2
    ;;
esac
NODE

cat >"$TEST_ROOT/bin/maestro-recorder" <<'MAESTRO_RECORDER'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >>"$FAKE_MAESTRO_LOG"
MAESTRO_RECORDER

chmod +x \
  "$TEST_ROOT/bin/maestro" \
  "$TEST_ROOT/bin/adb" \
  "$TEST_ROOT/bin/sleep" \
  "$TEST_ROOT/bin/node" \
  "$TEST_ROOT/bin/maestro-recorder"

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

run_flow_discovery_failure_case() {
  local platform="$1"
  local scenario="$2"
  local expected_error="$3"
  local case_dir="$TEST_ROOT/$platform-$scenario"
  local output_path="$case_dir/output.log"
  local adb_log_path="$case_dir/adb.log"
  local maestro_log_path="$case_dir/maestro.log"
  local test_script="$SCRIPT_DIR/test-e2e-$platform.sh"
  local command_status

  mkdir -p "$case_dir"

  if (
    unset ANDROID_SERIAL
    PATH="$TEST_ROOT/bin:$PATH" \
      ADB="$TEST_ROOT/bin/adb" \
      NODE="$TEST_ROOT/bin/node" \
      MAESTRO="$TEST_ROOT/bin/maestro-recorder" \
      FAKE_ADB_LOG="$adb_log_path" \
      FAKE_NODE_SCENARIO="$scenario" \
      FAKE_MAESTRO_LOG="$maestro_log_path" \
      "$test_script"
  ) >"$output_path" 2>&1; then
    command_status=0
  else
    command_status=$?
  fi

  if [[ "$command_status" -eq 0 ]]; then
    echo "$platform E2E unexpectedly accepted $scenario flow discovery." >&2
    return 1
  fi

  grep -Fq "$expected_error" "$output_path"

  if [[ -e "$maestro_log_path" ]]; then
    echo "$platform E2E invoked Maestro after $scenario flow discovery." >&2
    return 1
  fi
}

run_flow_discovery_failure_case \
  android \
  parser-error \
  "Failed to discover android Maestro flows."
run_flow_discovery_failure_case \
  android \
  empty \
  "No android Maestro flows were discovered."
run_flow_discovery_failure_case \
  ios \
  parser-error \
  "Failed to discover ios Maestro flows."
run_flow_discovery_failure_case \
  ios \
  empty \
  "No ios Maestro flows were discovered."

echo "Maestro retry recovery self-test passed."
