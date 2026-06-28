#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage: maestro-retry-flows.sh --platform <android|ios> --flow-dir <dir> [options] -- <flow.yaml>...

Options:
  --attempts <n>        Total attempts per flow. Default: 3.
  --maestro <path>      Maestro executable. Default: maestro.
  --maestro-arg <arg>   Extra Maestro arg. Can be repeated.
  --env <key=value>     Extra Maestro env var. Can be repeated.
  --suite-name <name>   Label used in log messages. Default: suite.
  --failure-log-lines <n|all>
                      Lines of each final failed flow log to print. Default: all.
USAGE
}

PLATFORM=""
FLOW_DIR=""
ATTEMPTS="${MAESTRO_RETRY_ATTEMPTS:-3}"
MAESTRO_BIN="${MAESTRO:-maestro}"
SUITE_NAME="suite"
FAILURE_LOG_LINES="${MAESTRO_RETRY_FAILURE_LOG_LINES:-all}"
INFRA_RETRIES="${MAESTRO_INFRA_RETRIES:-2}"
MAESTRO_ARGS=()
MAESTRO_ENV_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --platform)
      PLATFORM="$2"
      shift 2
      ;;
    --flow-dir)
      FLOW_DIR="$2"
      shift 2
      ;;
    --attempts)
      ATTEMPTS="$2"
      shift 2
      ;;
    --maestro)
      MAESTRO_BIN="$2"
      shift 2
      ;;
    --maestro-arg)
      MAESTRO_ARGS+=("$2")
      shift 2
      ;;
    --env)
      MAESTRO_ENV_ARGS+=("-e" "$2")
      shift 2
      ;;
    --suite-name)
      SUITE_NAME="$2"
      shift 2
      ;;
    --failure-log-lines)
      FAILURE_LOG_LINES="$2"
      shift 2
      ;;
    --)
      shift
      break
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ -z "$PLATFORM" || -z "$FLOW_DIR" ]]; then
  usage
  exit 2
fi
if ! [[ "$ATTEMPTS" =~ ^[1-9][0-9]*$ ]]; then
  echo "--attempts must be a positive integer." >&2
  exit 2
fi
if [[ "$FAILURE_LOG_LINES" != "all" ]] && ! [[ "$FAILURE_LOG_LINES" =~ ^[1-9][0-9]*$ ]]; then
  echo "--failure-log-lines must be a positive integer or 'all'." >&2
  exit 2
fi
if ! [[ "$INFRA_RETRIES" =~ ^[0-9]+$ ]]; then
  echo "MAESTRO_INFRA_RETRIES must be a non-negative integer." >&2
  exit 2
fi

PENDING=("$@")
if [[ "${#PENDING[@]}" -eq 0 ]]; then
  echo "No Maestro flows to run."
  exit 0
fi

RUN_DIR="${MAESTRO_RETRY_RUN_DIR:-$HOME/.maestro/tests/retry-$(date +%Y-%m-%d_%H%M%S)}"
mkdir -p "$RUN_DIR"

flow_log_path() {
  local attempt="$1"
  local flow="$2"
  local name
  name="$(basename "$flow" .yaml)"
  printf '%s/attempt-%s-%s.log' "$RUN_DIR" "$attempt" "$name"
}

is_android_driver_infra_failure() {
  local log_path="$1"
  [[ "$PLATFORM" == "android" ]] || return 1
  grep -Eq \
    'Maestro Android driver did not start up in time|io\.grpc\.StatusRuntimeException: UNAVAILABLE|Command failed \(tcp:[0-9]+\): closed' \
    "$log_path"
}

recover_android_driver() {
  [[ "$PLATFORM" == "android" ]] || return

  local adb_bin="${ADB:-adb}"
  local adb_device_args=()
  if [[ -n "${ANDROID_SERIAL:-}" ]]; then
    adb_device_args=(-s "$ANDROID_SERIAL")
  fi

  if command -v "$adb_bin" >/dev/null 2>&1; then
    "$adb_bin" kill-server >/dev/null 2>&1 || true
    "$adb_bin" start-server >/dev/null 2>&1 || true
    "$adb_bin" "${adb_device_args[@]}" wait-for-device >/dev/null 2>&1 || true
    sleep 3
  fi
}

dismiss_ios_open_alert() {
  local attempt="$1"
  local flow="$2"

  [[ "$PLATFORM" == "ios" ]] || return

  local alert_flow="$FLOW_DIR/dismiss-ios-open-alert.yaml"
  [[ -f "$alert_flow" ]] || return

  local cleanup_log
  cleanup_log="$RUN_DIR/ios-open-alert-cleanup-${attempt}-$(basename "$flow" .yaml).log"

  local cleanup_cmd=("$MAESTRO_BIN" test --platform "$PLATFORM")
  if [[ "${#MAESTRO_ARGS[@]}" -gt 0 ]]; then
    cleanup_cmd+=("${MAESTRO_ARGS[@]}")
  fi
  cleanup_cmd+=("$alert_flow")

  if ! "${cleanup_cmd[@]}" >"$cleanup_log" 2>&1; then
    echo "iOS open-alert cleanup failed before $flow. Continuing; log: $cleanup_log"
  fi
}

run_flow() {
  local attempt="$1"
  local flow="$2"
  local path="$FLOW_DIR/$flow"
  local log_path
  log_path="$(flow_log_path "$attempt" "$flow")"
  local infra_try status

  if [[ ! -f "$path" ]]; then
    echo "Missing Maestro flow: $path" | tee "$log_path" >&2
    return 1
  fi

  for ((infra_try = 0; infra_try <= INFRA_RETRIES; infra_try++)); do
    if [[ "$infra_try" -eq 0 ]]; then
      echo "::group::Maestro $SUITE_NAME attempt $attempt/$ATTEMPTS: $flow"
    else
      echo "::group::Maestro $SUITE_NAME attempt $attempt/$ATTEMPTS: $flow (driver recovery $infra_try/$INFRA_RETRIES)"
      recover_android_driver
    fi

    dismiss_ios_open_alert "$attempt" "$flow"

    set +e
    CMD=("$MAESTRO_BIN" test --platform "$PLATFORM")
    if [[ "${#MAESTRO_ARGS[@]}" -gt 0 ]]; then
      CMD+=("${MAESTRO_ARGS[@]}")
    fi
    if [[ "${#MAESTRO_ENV_ARGS[@]}" -gt 0 ]]; then
      CMD+=("${MAESTRO_ENV_ARGS[@]}")
    fi
    CMD+=("$path")
    "${CMD[@]}" 2>&1 | tee "$log_path"
    status="${PIPESTATUS[0]}"
    set -e
    echo "::endgroup::"

    if [[ "$status" -eq 0 ]]; then
      return 0
    fi
    if ! is_android_driver_infra_failure "$log_path"; then
      return "$status"
    fi
    if [[ "$infra_try" -lt "$INFRA_RETRIES" ]]; then
      echo "Maestro Android driver infra failure detected. Recovering ADB and retrying $flow without consuming a flow attempt."
    fi
  done

  return "$status"
}

print_final_failure_log() {
  local flow="$1"
  local log_path
  log_path="$(flow_log_path "$ATTEMPTS" "$flow")"

  echo "::group::Maestro final failure log: $flow"
  if [[ -f "$log_path" ]]; then
    echo "Last attempt log: $log_path"
    if [[ "$FAILURE_LOG_LINES" == "all" ]]; then
      cat "$log_path"
    else
      tail -n "$FAILURE_LOG_LINES" "$log_path"
    fi
  else
    echo "Missing final attempt log: $log_path"
  fi
  echo "::endgroup::"
}

for ((attempt = 1; attempt <= ATTEMPTS; attempt++)); do
  if [[ "$attempt" -eq 1 ]]; then
    echo "Maestro $SUITE_NAME attempt $attempt/$ATTEMPTS: initial full sweep (${#PENDING[@]} flow(s))"
  else
    echo "Maestro $SUITE_NAME attempt $attempt/$ATTEMPTS: retry failed flows only (${#PENDING[@]} flow(s))"
  fi
  NEXT=()

  for flow in "${PENDING[@]}"; do
    if run_flow "$attempt" "$flow"; then
      echo "PASS: $flow"
    else
      echo "FAIL: $flow"
      NEXT+=("$flow")
    fi
  done

  if [[ "${#NEXT[@]}" -eq 0 ]]; then
    PENDING=()
    echo "All Maestro $SUITE_NAME flows passed after attempt $attempt/$ATTEMPTS."
    exit 0
  fi
  PENDING=("${NEXT[@]}")
done

echo "::group::Maestro final failures"
echo "Final failed Maestro $SUITE_NAME flow(s): ${#PENDING[@]}"
for flow in "${PENDING[@]}"; do
  echo "- $flow"
done
echo "Retry logs: $RUN_DIR"
echo "::endgroup::"

for flow in "${PENDING[@]}"; do
  print_final_failure_log "$flow"
done

exit 1
