#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_DIR="$ROOT_DIR/packages/react-native-nitro-geolocation"
OUT_DIR_INPUT="${1:-$ROOT_DIR/build/prebuilt}"
WORK_DIR="${RUNNER_TEMP:-$ROOT_DIR/build}/nitro-geolocation-rn087-spm"
APP_DIR="$WORK_DIR/NitroGeolocationSPMExample"
PACK_DIR="$WORK_DIR/package"
NITRO_VERSION="$(node -p "require('$PACKAGE_DIR/package.json').nitroGeolocation.spmNitroVersion")"

rm -rf "$WORK_DIR"
mkdir -p "$PACK_DIR" "$OUT_DIR_INPUT"
OUT_DIR="$(cd "$OUT_DIR_INPUT" && pwd)"

npx --yes @react-native-community/cli@20.2.0 init NitroGeolocationSPMExample \
  --version 0.87.1 \
  --skip-install \
  --directory "$APP_DIR"

package_archive="$({ npm pack "$PACKAGE_DIR" --pack-destination "$PACK_DIR" --json; } | node -e '
  let input = "";
  process.stdin.on("data", chunk => { input += chunk; });
  process.stdin.on("end", () => {
    const metadata = JSON.parse(input);
    process.stdout.write(metadata[0].filename);
  });
')"

(
  cd "$APP_DIR"
  npm install "$PACK_DIR/$package_archive" "react-native-nitro-modules@$NITRO_VERSION"
  bundle install
  USE_FRAMEWORKS=static \
    NITRO_GEOLOCATION_USE_PREBUILT=0 \
    bundle exec pod install --project-directory=ios
)

scripts/build-spm-prebuilt-ios.sh "$APP_DIR" "$OUT_DIR"

node -e '
  const fs = require("node:fs");
  const config = require(process.argv[1]);
  fs.writeFileSync(process.argv[2], config.swiftPMReactNativeConfigSource);
' \
  "$APP_DIR/node_modules/react-native-nitro-geolocation/spm/config.cjs" \
  "$APP_DIR/react-native.config.js"
(
  cd "$APP_DIR"
  NITRO_GEOLOCATION_SPM_CACHE_DIR="$WORK_DIR/spm-cache" \
    NITRO_GEOLOCATION_SPM_ARTIFACTS_DIR="$ROOT_DIR/build/ios-spm-prebuilt/staging" \
    bundle exec npx react-native spm scaffold --yes
  NITRO_GEOLOCATION_SPM_CACHE_DIR="$WORK_DIR/spm-cache" \
    NITRO_GEOLOCATION_SPM_ARTIFACTS_DIR="$ROOT_DIR/build/ios-spm-prebuilt/staging" \
    bundle exec npx react-native spm add --deintegrate --yes

  xcodebuild build -quiet \
    -project ios/NitroGeolocationSPMExample.xcodeproj \
    -scheme NitroGeolocationSPMExample \
    -configuration Debug \
    -destination "generic/platform=iOS Simulator" \
    -derivedDataPath "$WORK_DIR/DerivedData-debug" \
    CODE_SIGNING_ALLOWED=NO

  xcodebuild build -quiet \
    -project ios/NitroGeolocationSPMExample.xcodeproj \
    -scheme NitroGeolocationSPMExample \
    -configuration Release \
    -destination "generic/platform=iOS Simulator" \
    -derivedDataPath "$WORK_DIR/DerivedData-release" \
    CODE_SIGNING_ALLOWED=NO

  xcodebuild build -quiet \
    -project ios/NitroGeolocationSPMExample.xcodeproj \
    -scheme NitroGeolocationSPMExample \
    -configuration Release \
    -destination "generic/platform=iOS" \
    -derivedDataPath "$WORK_DIR/DerivedData-device" \
    CODE_SIGNING_ALLOWED=NO
)

echo "RN 0.87 SwiftPM consumer build passed."
