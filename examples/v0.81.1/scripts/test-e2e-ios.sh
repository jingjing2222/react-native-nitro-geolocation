#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXAMPLE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FLOW_DIR="$EXAMPLE_DIR/.maestro"

MAESTRO_BIN="${MAESTRO:-maestro}"

"$MAESTRO_BIN" test --platform ios "$FLOW_DIR/all-tests.yaml"
