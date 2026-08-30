#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_DIR="$ROOT_DIR/packages/react-native-nitro-geolocation"
APP_DIR="${1:?Usage: scripts/build-spm-prebuilt-ios.sh <rn-0.87-app-dir> [output-dir]}"
OUT_DIR_INPUT="${2:-$ROOT_DIR/build/prebuilt}"
IOS_DIR="$APP_DIR/ios"
WORKSPACE="$IOS_DIR/NitroGeolocationSPMExample.xcworkspace"
BUILD_DIR="$ROOT_DIR/build/ios-spm-prebuilt"
STAGING_DIR="$BUILD_DIR/staging"
VERSION="$(node -p "require('$PACKAGE_DIR/package.json').version")"
NITRO_VERSION="$(node -p "require('$PACKAGE_DIR/package.json').nitroGeolocation.spmNitroVersion")"
ASSET_NAME="react-native-nitro-geolocation-${VERSION}-ios-spm.xcframeworks.zip"

mkdir -p "$OUT_DIR_INPUT" "$BUILD_DIR"
OUT_DIR="$(cd "$OUT_DIR_INPUT" && pwd)"

installed_nitro_version="$(node -p "require('$APP_DIR/node_modules/react-native-nitro-modules/package.json').version")"
if [[ "$installed_nitro_version" != "$NITRO_VERSION" ]]; then
  echo "Expected react-native-nitro-modules $NITRO_VERSION, found $installed_nitro_version" >&2
  exit 1
fi

archive_framework() {
  local scheme="$1"
  local destination="$2"
  local device_archive="$BUILD_DIR/${scheme}-ios.xcarchive"
  local simulator_archive="$BUILD_DIR/${scheme}-ios-simulator.xcarchive"

  rm -rf "$device_archive" "$simulator_archive" "$destination"

  xcodebuild archive -quiet \
    -workspace "$WORKSPACE" \
    -scheme "$scheme" \
    -configuration Release \
    -destination "generic/platform=iOS" \
    -archivePath "$device_archive" \
    SKIP_INSTALL=NO \
    BUILD_LIBRARY_FOR_DISTRIBUTION=NO

  xcodebuild archive -quiet \
    -workspace "$WORKSPACE" \
    -scheme "$scheme" \
    -configuration Release \
    -destination "generic/platform=iOS Simulator" \
    -archivePath "$simulator_archive" \
    SKIP_INSTALL=NO \
    BUILD_LIBRARY_FOR_DISTRIBUTION=NO

  while IFS= read -r swift_module; do
    rm -rf "$swift_module"
  done < <(
    find \
      "$device_archive/Products/Library/Frameworks/$scheme.framework/Modules" \
      "$simulator_archive/Products/Library/Frameworks/$scheme.framework/Modules" \
      -maxdepth 1 -type d -name '*.swiftmodule' 2>/dev/null
  )

  xcodebuild -create-xcframework \
    -framework "$device_archive/Products/Library/Frameworks/$scheme.framework" \
    -framework "$simulator_archive/Products/Library/Frameworks/$scheme.framework" \
    -output "$destination"
}

archive_framework "NitroModules" "$BUILD_DIR/NitroModules.xcframework"
archive_framework "NitroGeolocation" "$BUILD_DIR/NitroGeolocation.xcframework"

while IFS= read -r framework; do
  cp "$PACKAGE_DIR/ios/PrivacyInfo.xcprivacy" "$framework/PrivacyInfo.xcprivacy"
done < <(find "$BUILD_DIR/NitroGeolocation.xcframework" -type d -name '*.framework')

rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"
cp -R "$BUILD_DIR/NitroModules.xcframework" "$STAGING_DIR/"
cp -R "$BUILD_DIR/NitroGeolocation.xcframework" "$STAGING_DIR/"

rm -f "$OUT_DIR/$ASSET_NAME" "$OUT_DIR/$ASSET_NAME.sha256"
(
  cd "$STAGING_DIR"
  /usr/bin/zip -qry "$OUT_DIR/$ASSET_NAME" \
    NitroModules.xcframework \
    NitroGeolocation.xcframework
)
(
  cd "$OUT_DIR"
  shasum -a 256 "$ASSET_NAME" > "$ASSET_NAME.sha256"
)

echo "$OUT_DIR/$ASSET_NAME"
