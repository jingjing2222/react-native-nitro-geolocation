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
USAGE
}

PLATFORM=""
FLOW_DIR=""
ATTEMPTS="${MAESTRO_RETRY_ATTEMPTS:-3}"
MAESTRO_BIN="${MAESTRO:-maestro}"
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

run_flow() {
  local attempt="$1"
  local flow="$2"
  local path="$FLOW_DIR/$flow"
  local log_path
  log_path="$(flow_log_path "$attempt" "$flow")"

  if [[ ! -f "$path" ]]; then
    echo "Missing Maestro flow: $path" | tee "$log_path" >&2
    return 1
  fi

  echo "::group::Maestro attempt $attempt/$ATTEMPTS: $flow"
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
  local status="${PIPESTATUS[0]}"
  set -e
  echo "::endgroup::"

  return "$status"
}

for ((attempt = 1; attempt <= ATTEMPTS; attempt++)); do
  if [[ "$attempt" -eq 1 ]]; then
    echo "Maestro attempt $attempt/$ATTEMPTS: initial full sweep (${#PENDING[@]} flow(s))"
  else
    echo "Maestro attempt $attempt/$ATTEMPTS: retry failed flows only (${#PENDING[@]} flow(s))"
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
    echo "All Maestro flows passed after attempt $attempt/$ATTEMPTS."
    exit 0
  fi
  PENDING=("${NEXT[@]}")
done

echo "::group::Maestro final failures"
echo "Final failed Maestro flow(s): ${#PENDING[@]}"
for flow in "${PENDING[@]}"; do
  echo "- $flow"
done
echo "Retry logs: $RUN_DIR"
echo "::endgroup::"

exit 1
