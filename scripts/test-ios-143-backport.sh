#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
test_dir="$(mktemp -d /tmp/nitro-ios-143-backport.XXXXXX)"
trap 'rm -rf -- "$test_dir"' EXIT

if [[ -z "${DEVELOPER_DIR:-}" && -d /Applications/Xcode.app/Contents/Developer ]]; then
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
fi

npm pack react-native-nitro-geolocation@1.4.3 --ignore-scripts --loglevel=error --pack-destination "$test_dir" >/dev/null
mkdir -p "$test_dir/node_modules/react-native-nitro-geolocation"
tar -xzf "$test_dir/react-native-nitro-geolocation-1.4.3.tgz" \
  -C "$test_dir/node_modules/react-native-nitro-geolocation" --strip-components=1
git -C "$test_dir" apply --check "$repo_root/patches/react-native-nitro-geolocation+1.4.3.patch"
git -C "$test_dir" apply "$repo_root/patches/react-native-nitro-geolocation+1.4.3.patch"
xcrun swiftc -frontend -parse \
  "$test_dir/node_modules/react-native-nitro-geolocation/ios/NitroGeolocation.swift"
echo "Published 1.4.3 backport applies cleanly and Swift parsing passed"
