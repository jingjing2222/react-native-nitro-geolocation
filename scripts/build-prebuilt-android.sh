#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_DIR="$ROOT_DIR/packages/react-native-nitro-geolocation"
EXAMPLE_ANDROID_DIR="$ROOT_DIR/examples/v0.81.1/android"
OUT_DIR="${1:-$ROOT_DIR/build/prebuilt}"

VERSION="$(node -p "require('$PACKAGE_DIR/package.json').version")"
ASSET_NAME="react-native-nitro-geolocation-${VERSION}-android.aar"

mkdir -p "$OUT_DIR"

(
  cd "$EXAMPLE_ANDROID_DIR"
  NITRO_GEOLOCATION_USE_PREBUILT=0 ./gradlew \
    :react-native-nitro-geolocation:assembleRelease \
    -PNitroGeolocation_usePrebuilt=false \
    -PreactNativeArchitectures=armeabi-v7a,x86,x86_64,arm64-v8a \
    --no-daemon \
    --console=plain
)

AAR_PATH="$(find "$PACKAGE_DIR/android/build/outputs/aar" -name "*release.aar" -print -quit)"
if [[ -z "$AAR_PATH" ]]; then
  echo "release AAR not found under $PACKAGE_DIR/android/build/outputs/aar" >&2
  exit 1
fi

cp "$AAR_PATH" "$OUT_DIR/$ASSET_NAME"
shasum -a 256 "$OUT_DIR/$ASSET_NAME" > "$OUT_DIR/$ASSET_NAME.sha256"

echo "$OUT_DIR/$ASSET_NAME"
