#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
test_dir="$(mktemp -d /tmp/nitro-ios-lifecycle.XXXXXX)"

cleanup() {
  case "$test_dir" in
    /tmp/nitro-ios-lifecycle.*) rm -rf -- "$test_dir" ;;
    *) printf 'Refusing to remove unexpected test directory: %s\n' "$test_dir" >&2 ;;
  esac
}
trap cleanup EXIT

if [[ -z "${DEVELOPER_DIR:-}" && -d /Applications/Xcode.app/Contents/Developer ]]; then
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
fi

xcrun swiftc \
  -parse-as-library \
  "$repo_root/packages/react-native-nitro-geolocation/ios/IOSLifecycleEventPipeline.swift" \
  "$repo_root/packages/react-native-nitro-geolocation/ios/IOSBackgroundLocationDelegate.swift" \
  "$repo_root/tests/ios/IOSBackgroundLocationDelegateContract.swift" \
  -o "$test_dir/ios-location-lifecycle-contract"

"$test_dir/ios-location-lifecycle-contract"

xcrun swiftc \
  -parse-as-library \
  "$repo_root/packages/react-native-nitro-geolocation/ios/IOSPermissionRequestQueue.swift" \
  "$repo_root/tests/ios/IOSPermissionRequestQueueContract.swift" \
  -o "$test_dir/ios-permission-request-contract"

"$test_dir/ios-permission-request-contract"

xcrun swiftc \
  -parse-as-library \
  "$repo_root/packages/react-native-nitro-geolocation/ios/IOSNumericOptions.swift" \
  "$repo_root/tests/ios/IOSNumericOptionsContract.swift" \
  -o "$test_dir/ios-numeric-options-contract"

"$test_dir/ios-numeric-options-contract"
