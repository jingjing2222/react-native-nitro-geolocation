#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/examples/v0.81.1/android"
PACKAGE_JSON="$ROOT_DIR/packages/react-native-nitro-geolocation/package.json"
VERSION="$(node -p "require('$PACKAGE_JSON').version")"
ASSET_NAME="react-native-nitro-geolocation-${VERSION}-android.aar"
TEST_ROOT="$(mktemp -d -t nitro-geolocation-android-checksum.XXXXXX)"
RELEASE_DIR="$TEST_ROOT/release"
CACHE_DIR="$TEST_ROOT/cache"
OUTPUT_SO="$ROOT_DIR/packages/react-native-nitro-geolocation/android/build/generated/prebuilt-jni/arm64-v8a/libnitrogeolocation.so"

cleanup() {
  if [[ -n "$TEST_ROOT" && -d "$TEST_ROOT" ]]; then
    rm -rf -- "$TEST_ROOT"
  fi
}
trap cleanup EXIT

make_asset() {
  local contents="$1"
  local payload_dir="$TEST_ROOT/payload"
  rm -rf -- "$payload_dir"
  mkdir -p "$payload_dir/jni/arm64-v8a" "$RELEASE_DIR"
  printf '%s' "$contents" > "$payload_dir/jni/arm64-v8a/libnitrogeolocation.so"
  (
    cd "$payload_dir"
    zip -q -r "$RELEASE_DIR/$ASSET_NAME" jni
  )
  (
    cd "$RELEASE_DIR"
    shasum -a 256 "$ASSET_NAME" > "$ASSET_NAME.sha256"
  )
}

run_prebuilt_task() {
  NITRO_GEOLOCATION_USE_PREBUILT=1 \
    NITRO_GEOLOCATION_PREBUILT_URL_BASE="file://$RELEASE_DIR" \
    NITRO_GEOLOCATION_PREBUILT_CACHE_DIR="$CACHE_DIR" \
    "$ANDROID_DIR/gradlew" -p "$ANDROID_DIR" \
    :react-native-nitro-geolocation:prepareNitroGeolocationPrebuilt \
    -PNitroGeolocation_usePrebuilt=true --console=plain "$@"
}

run_configuration_only() {
  local scenario_cache="$1"
  NITRO_GEOLOCATION_USE_PREBUILT=1 \
    NITRO_GEOLOCATION_PREBUILT_URL_BASE="file://$RELEASE_DIR" \
    NITRO_GEOLOCATION_PREBUILT_CACHE_DIR="$scenario_cache" \
    "$ANDROID_DIR/gradlew" -p "$ANDROID_DIR" help \
    -PNitroGeolocation_usePrebuilt=true --console=plain
}

make_asset "native-v1"
cp "$RELEASE_DIR/$ASSET_NAME" "$TEST_ROOT/$ASSET_NAME.v1"
cp "$RELEASE_DIR/$ASSET_NAME.sha256" "$TEST_ROOT/$ASSET_NAME.v1.sha256"
run_prebuilt_task
test "$(<"$OUTPUT_SO")" = "native-v1"

rm -rf -- "$RELEASE_DIR"
run_prebuilt_task --rerun-tasks
test "$(<"$OUTPUT_SO")" = "native-v1"

mkdir -p "$RELEASE_DIR"
cp "$TEST_ROOT/$ASSET_NAME.v1" "$RELEASE_DIR/$ASSET_NAME"
cp "$TEST_ROOT/$ASSET_NAME.v1.sha256" "$RELEASE_DIR/$ASSET_NAME.sha256"
printf 'tampered' > "$CACHE_DIR/$ASSET_NAME"
run_prebuilt_task --rerun-tasks
cmp "$RELEASE_DIR/$ASSET_NAME" "$CACHE_DIR/$ASSET_NAME"

make_asset "native-v2"
cp "$RELEASE_DIR/$ASSET_NAME.sha256" "$CACHE_DIR/$ASSET_NAME.sha256"
run_prebuilt_task
test "$(<"$OUTPUT_SO")" = "native-v2"

MISMATCH_CACHE="$TEST_ROOT/mismatch-cache"
printf '%064d  %s\n' 0 "$ASSET_NAME" > "$RELEASE_DIR/$ASSET_NAME.sha256"
run_configuration_only "$MISMATCH_CACHE" 2>&1 | tee "$TEST_ROOT/mismatch.log"
grep -q "SHA-256 mismatch" "$TEST_ROOT/mismatch.log"
test ! -e "$MISMATCH_CACHE/$ASSET_NAME"

MALFORMED_CACHE="$TEST_ROOT/malformed-cache"
printf 'not-a-checksum\n' > "$RELEASE_DIR/$ASSET_NAME.sha256"
run_configuration_only "$MALFORMED_CACHE" 2>&1 | tee "$TEST_ROOT/malformed.log"
grep -q "Invalid SHA-256" "$TEST_ROOT/malformed.log"
test ! -e "$MALFORMED_CACHE/$ASSET_NAME"

echo "Android prebuilt checksum tests passed."
