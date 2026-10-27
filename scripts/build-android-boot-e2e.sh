#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
OUT="$ROOT/build/boot-e2e"
BASELINE=89704cfcc26e5dd0f2eebc40c6969b0aeca620a4
ARCH="${REACT_NATIVE_ARCHITECTURES:-x86}"
SOURCE=packages/react-native-nitro-geolocation/android/src/main/java/com/margelo/nitro/nitrogeolocation/background
FILES=(NitroBootReceiver.kt NitroBootRestoreJobService.kt NitroBackgroundStore.kt)
BACKUP="$(mktemp -d)"
mkdir -p "$OUT"

for name in "${FILES[@]}"; do cp "$SOURCE/$name" "$BACKUP/$name"; done
restore_sources() {
  for name in "${FILES[@]}"; do cp "$BACKUP/$name" "$SOURCE/$name"; done
}
cleanup() { restore_sources; rm -rf "$BACKUP"; }
trap cleanup EXIT

build_apk() {
  local phase="$1"
  ./examples/v0.81.1/android/gradlew -p examples/v0.81.1/android \
    --no-daemon --console=plain -PnitroBootE2e=true \
    -PNitroGeolocation_usePrebuilt=false -PreactNativeArchitectures="$ARCH" \
    :boot-consumer:assembleDebug > "$OUT/$phase-build.log" 2>&1 || {
      tail -100 "$OUT/$phase-build.log" >&2
      return 1
    }
  cp tests/android/boot-consumer/build/outputs/apk/debug/boot-consumer-debug.apk "$OUT/$phase.apk"
  cp tests/android/boot-consumer/build/intermediates/merged_manifests/debug/processDebugManifest/AndroidManifest.xml "$OUT/$phase-manifest.xml"
}

git rev-parse HEAD > "$OUT/tested-sha.txt"
printf '%s\n' "$BASELINE" > "$OUT/baseline-sha.txt"
if [[ "${BUILD_RED:-1}" == 1 ]]; then
  for name in "${FILES[@]}"; do git show "$BASELINE:$SOURCE/$name" > "$SOURCE/$name"; done
  git diff -- "$SOURCE" > "$OUT/red-source-diff.patch"
  build_apk red
  restore_sources
fi
build_apk green
(cd "$OUT" && shasum -a 256 ./*.apk > apk-sha256.txt)
