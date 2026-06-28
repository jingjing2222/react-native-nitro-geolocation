#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_DIR="$ROOT_DIR/packages/react-native-nitro-geolocation"
EXAMPLE_DIR="$ROOT_DIR/examples/v0.81.1"
IOS_DIR="$EXAMPLE_DIR/ios"
OUT_DIR="${1:-$ROOT_DIR/build/prebuilt}"
BUILD_DIR="$ROOT_DIR/build/ios-prebuilt"

VERSION="$(node -p "require('$PACKAGE_DIR/package.json').version")"
ASSET_NAME="react-native-nitro-geolocation-${VERSION}-ios.xcframework.zip"
WORKSPACE="$IOS_DIR/NitroGeolocationExample.xcworkspace"
SCHEME="NitroGeolocation"

mkdir -p "$OUT_DIR" "$BUILD_DIR"

(
  if [[ -f "$EXAMPLE_DIR/Gemfile" ]]; then
    cd "$EXAMPLE_DIR"
    USE_FRAMEWORKS=static NITRO_GEOLOCATION_USE_PREBUILT=0 bundle exec pod install --project-directory=ios
  else
    cd "$IOS_DIR"
    USE_FRAMEWORKS=static NITRO_GEOLOCATION_USE_PREBUILT=0 pod install
  fi
)

rm -rf "$BUILD_DIR/NitroGeolocation.xcframework" \
  "$BUILD_DIR/ios.xcarchive" \
  "$BUILD_DIR/ios-simulator.xcarchive"

xcodebuild archive \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$BUILD_DIR/ios.xcarchive" \
  SKIP_INSTALL=NO \
  BUILD_LIBRARY_FOR_DISTRIBUTION=YES

xcodebuild archive \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination "generic/platform=iOS Simulator" \
  -archivePath "$BUILD_DIR/ios-simulator.xcarchive" \
  SKIP_INSTALL=NO \
  BUILD_LIBRARY_FOR_DISTRIBUTION=YES

xcodebuild -create-xcframework \
  -framework "$BUILD_DIR/ios.xcarchive/Products/Library/Frameworks/NitroGeolocation.framework" \
  -framework "$BUILD_DIR/ios-simulator.xcarchive/Products/Library/Frameworks/NitroGeolocation.framework" \
  -output "$BUILD_DIR/NitroGeolocation.xcframework"

rm -f "$OUT_DIR/$ASSET_NAME" "$OUT_DIR/$ASSET_NAME.sha256"
(
  cd "$BUILD_DIR"
  /usr/bin/ditto -c -k --sequesterRsrc --keepParent NitroGeolocation.xcframework "$OUT_DIR/$ASSET_NAME"
)
shasum -a 256 "$OUT_DIR/$ASSET_NAME" > "$OUT_DIR/$ASSET_NAME.sha256"

echo "$OUT_DIR/$ASSET_NAME"
