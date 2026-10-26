#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
OUT=build/boot-e2e
if [[ "${BUILD_RED:-1}" == 1 ]]; then
  status=0
  python3 scripts/test-android-boot-e2e.py "$OUT/red.apk" "$OUT/red" || status=$?
  test "$status" = 1
  python3 - "$OUT/red/result.json" <<'PY'
import json, sys
with open(sys.argv[1]) as file:
    result = json.load(file)
assert result["passed"] is False, result
assert result["api"] == "27", result
assert result["failure"] == "boot_job_without_constraints", result
assert result["receiverStarted"] is True, result
assert result["bootBefore"] != result["bootAfter"], result
print("RED confirmed: Android 8.1 crashed in the production boot receiver with the original JobInfo exception.")
PY
fi
python3 scripts/test-android-boot-e2e.py "$OUT/green.apk" "$OUT/green"
echo "GREEN confirmed: a real reboot delivered the production receiver without a crash, background database, or pending job."
