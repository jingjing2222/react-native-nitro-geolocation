#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
test_dir="$(mktemp -d /tmp/nitro-ios-watch-delivery.XXXXXX)"

cleanup() {
  case "$test_dir" in
    /tmp/nitro-ios-watch-delivery.*) rm -rf -- "$test_dir" ;;
    *) printf 'Refusing to remove unexpected test directory: %s\n' "$test_dir" >&2 ;;
  esac
}
trap cleanup EXIT

if [[ -z "${DEVELOPER_DIR:-}" && -d /Applications/Xcode.app/Contents/Developer ]]; then
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
fi

xcrun swiftc \
  -parse-as-library \
  "$repo_root/packages/react-native-nitro-geolocation/ios/IOSWatchDeliveryPolicy.swift" \
  "$repo_root/tests/ios/IOSWatchDeliveryPolicyContract.swift" \
  -o "$test_dir/ios-watch-delivery-contract"

"$test_dir/ios-watch-delivery-contract"
