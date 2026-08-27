#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_DIR="$ROOT_DIR/packages/react-native-nitro-geolocation"
EXAMPLE_DIR="$ROOT_DIR/examples/v0.81.1"
IOS_DIR="$EXAMPLE_DIR/ios"
OUT_DIR_INPUT="${1:-$ROOT_DIR/build/prebuilt}"
BUILD_DIR="$ROOT_DIR/build/ios-prebuilt"

VERSION="$(node -p "require('$PACKAGE_DIR/package.json').version")"
ASSET_NAME="react-native-nitro-geolocation-${VERSION}-ios.xcframework.zip"
WORKSPACE="$IOS_DIR/NitroGeolocationExample.xcworkspace"
SCHEME="NitroGeolocation"

mkdir -p "$OUT_DIR_INPUT" "$BUILD_DIR"
OUT_DIR="$(cd "$OUT_DIR_INPUT" && pwd)"

(
  if [[ -f "$EXAMPLE_DIR/Gemfile" ]]; then
    cd "$EXAMPLE_DIR"
    USE_FRAMEWORKS=static \
      NITRO_GEOLOCATION_USE_PREBUILT=0 \
      bundle exec pod install --project-directory=ios
  else
    cd "$IOS_DIR"
    USE_FRAMEWORKS=static \
      NITRO_GEOLOCATION_USE_PREBUILT=0 \
      pod install
  fi
)

rm -rf "$BUILD_DIR/NitroGeolocation.xcframework" \
  "$BUILD_DIR/ios.xcarchive" \
  "$BUILD_DIR/ios-simulator.xcarchive"

# This package's native surface is linked through Nitro's generated registry;
# consumers do not import its Swift module. Nitro Modules exposes C++20 headers,
# while Swift's textual-interface verifier currently reparses imported C++ as
# C++17. Avoid shipping an invalid interface and validate the linkable static
# framework slices instead.
xcodebuild archive -quiet \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$BUILD_DIR/ios.xcarchive" \
  SKIP_INSTALL=NO \
  BUILD_LIBRARY_FOR_DISTRIBUTION=NO

xcodebuild archive -quiet \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination "generic/platform=iOS Simulator" \
  -archivePath "$BUILD_DIR/ios-simulator.xcarchive" \
  SKIP_INSTALL=NO \
  BUILD_LIBRARY_FOR_DISTRIBUTION=NO

rm -rf \
  "$BUILD_DIR/ios.xcarchive/Products/Library/Frameworks/NitroGeolocation.framework/Modules/NitroGeolocation.swiftmodule" \
  "$BUILD_DIR/ios-simulator.xcarchive/Products/Library/Frameworks/NitroGeolocation.framework/Modules/NitroGeolocation.swiftmodule"

xcodebuild -create-xcframework \
  -framework "$BUILD_DIR/ios.xcarchive/Products/Library/Frameworks/NitroGeolocation.framework" \
  -framework "$BUILD_DIR/ios-simulator.xcarchive/Products/Library/Frameworks/NitroGeolocation.framework" \
  -output "$BUILD_DIR/NitroGeolocation.xcframework"

while IFS= read -r framework; do
  cp "$PACKAGE_DIR/ios/PrivacyInfo.xcprivacy" "$framework/PrivacyInfo.xcprivacy"
done < <(find "$BUILD_DIR/NitroGeolocation.xcframework" -type d -name '*.framework')

rm -f "$OUT_DIR/$ASSET_NAME" "$OUT_DIR/$ASSET_NAME.sha256"
(
  cd "$BUILD_DIR"
  /usr/bin/ditto -c -k --sequesterRsrc --keepParent NitroGeolocation.xcframework "$OUT_DIR/$ASSET_NAME"
)
(
  cd "$OUT_DIR"
  shasum -a 256 "$ASSET_NAME" > "$ASSET_NAME.sha256"
)

echo "$OUT_DIR/$ASSET_NAME"
