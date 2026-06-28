#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXAMPLE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FLOW_DIR="$EXAMPLE_DIR/.maestro"

MAESTRO_BIN="${MAESTRO:-maestro}"

COMMON_FLOWS=(
  permission-check.yaml
  current-position.yaml
  watch-position.yaml
  location-simulation.yaml
  accuracy-presets.yaml
  last-known-position.yaml
  geocoding.yaml
  location-availability.yaml
  heading.yaml
)

IOS_FLOWS=(
  issue-119-ios.yaml
  issue-120-ios.yaml
  issue-121-ios.yaml
  issue-122-ios.yaml
  "${COMMON_FLOWS[@]}"
  ios-location-tuning.yaml
  ios-accuracy-authorization.yaml
  ios-release-options-bridge.yaml
  background-e2e.yaml
  mocked-metadata-ios-true.yaml
  api-errors.yaml
  compat-api.yaml
)

"$SCRIPT_DIR/maestro-retry-flows.sh" \
  --platform ios \
  --flow-dir "$FLOW_DIR" \
  --maestro "$MAESTRO_BIN" \
  -- "${IOS_FLOWS[@]}"
