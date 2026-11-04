#!/usr/bin/env bash
# Record the native configuration contract using real CoreLocation on a booted simulator.
# Usage: bash scripts/record-ios-background-configuration.sh SOURCE.swift RED OUTPUT_DIR
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_file="${1:?Pass the production NitroGeolocation.swift to test}"
phase="${2:?Pass RED or GREEN}"
output_dir="${3:?Pass an output directory}"
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
mkdir -p "$output_dir"
output_dir="$(cd "$output_dir" && pwd)"
test_dir="$(mktemp -d /tmp/nitro-background-simulator.XXXXXX)"
trap 'rm -rf -- "$test_dir"' EXIT
app="$test_dir/BackgroundContract.app"
mkdir -p "$app"
python3 "$repo_root/scripts/test-ios-background-configuration.py" --source "$source_file" --emit "$test_dir/Contract.swift"
python3 - "$app/Info.plist" "$phase" <<'PY'
import plistlib
import sys
with open(sys.argv[1], 'wb') as output:
    plistlib.dump({
        'CFBundleIdentifier': 'org.nitro.background-contract',
        'CFBundleExecutable': 'BackgroundContract',
        'CFBundleName': 'Background Contract',
        'CFBundlePackageType': 'APPL',
        'CFBundleVersion': '1',
        'CFBundleShortVersionString': '1.0',
        'MinimumOSVersion': '15.0',
        'UILaunchScreen': {},
        'UIDeviceFamily': [1, 2],
        'UIBackgroundModes': ['location'],
        'NSLocationWhenInUseUsageDescription': 'Verify background configuration.',
        'NSLocationAlwaysAndWhenInUseUsageDescription': 'Verify pre-granted permission.',
        'EvidencePhase': sys.argv[2],
    }, output)
PY
export SDKROOT="$(xcrun --sdk iphonesimulator --show-sdk-path)"
xcrun swiftc -parse-as-library -sdk "$SDKROOT" \
  -target "$(uname -m)-apple-ios15.0-simulator" "$test_dir/Contract.swift" -o "$app/BackgroundContract"
xcrun simctl install booted "$app"
xcrun simctl privacy booted grant location-always org.nitro.background-contract
xcrun simctl launch --terminate-running-process --console-pty booted org.nitro.background-contract > "$output_dir/$phase-simulator.log" 2>&1 &
launch_pid=$!
sleep 2
xcrun simctl io booted recordVideo --codec=h264 --force "$output_dir/$phase.mp4" > "$output_dir/$phase-recording.log" 2>&1 &
record_pid=$!
sleep 7
kill -INT "$record_pid"
wait "$record_pid"
xcrun simctl io booted screenshot "$output_dir/$phase.png"
xcrun simctl terminate booted org.nitro.background-contract
wait "$launch_pid" || true
cat "$output_dir/$phase-simulator.log"

# A successful recording command must also have run the contract to completion.
grep -Eq '[0-9]+/10 passed' "$output_dir/$phase-simulator.log"
if [[ "$phase" == "GREEN" ]]; then
  grep -q '10/10 passed' "$output_dir/$phase-simulator.log"
fi
