#!/usr/bin/env bash
set -euo pipefail

PLATFORM="${1:-}"
if [[ "$PLATFORM" != "ios" && "$PLATFORM" != "android" ]]; then
  echo "Usage: $0 ios|android" >&2
  exit 2
fi

GITHUB_ENV="${GITHUB_ENV:-/dev/null}"
GITHUB_PATH="${GITHUB_PATH:-/dev/null}"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "E2E self-hosted runner bootstrap only supports macOS." >&2
  exit 1
fi

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is required on the E2E runner before bootstrap can install tools." >&2
  exit 1
fi

if ! command -v mise >/dev/null 2>&1; then
  brew install mise
fi

mise trust --yes
mise install node java maestro
if [[ "$PLATFORM" == "ios" ]]; then
  mise install ruby
fi
mise reshim

NODE_BIN="$(mise which node)"
COREPACK_BIN="$(mise which corepack)"
JAVA_HOME_VALUE="$(mise where java)"
MAESTRO_BIN="$(mise which maestro)"
MISE_SHIMS_DIR="$HOME/.local/share/mise/shims"

{
  echo "$MISE_SHIMS_DIR"
  echo "$(dirname "$NODE_BIN")"
  echo "$JAVA_HOME_VALUE/bin"
  echo "$(dirname "$MAESTRO_BIN")"
} >> "$GITHUB_PATH"

{
  echo "JAVA_HOME=$JAVA_HOME_VALUE"
  echo "MAESTRO=$MAESTRO_BIN"
  echo "NODE=$NODE_BIN"
} >> "$GITHUB_ENV"

"$NODE_BIN" -v
"$COREPACK_BIN" enable
"$COREPACK_BIN" prepare yarn@4.9.4 --activate
"$(mise which yarn)" --version
"$JAVA_HOME_VALUE/bin/java" -version
"$MAESTRO_BIN" --version

if [[ "$PLATFORM" == "ios" ]]; then
  if ! xcodebuild -version >/dev/null 2>&1 && [[ -d /Applications/Xcode.app/Contents/Developer ]]; then
    export DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer"
  fi

  if ! xcodebuild -version >/dev/null 2>&1; then
    echo "Full Xcode is required for iOS E2E. Install Xcode and run: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer" >&2
    exit 1
  fi

  echo "DEVELOPER_DIR=${DEVELOPER_DIR:-$(xcode-select -p)}" >> "$GITHUB_ENV"

  BUNDLE_BIN="$(mise which bundle || true)"
  POD_BIN="$(mise which pod || true)"

  if [[ -z "$BUNDLE_BIN" ]] || ! "$BUNDLE_BIN" --version >/dev/null 2>&1; then
    mise exec ruby -- gem install bundler --no-document
  fi
  if [[ -z "$POD_BIN" ]] || ! "$POD_BIN" --version >/dev/null 2>&1; then
    mise exec ruby -- gem install cocoapods --no-document
  fi
  mise reshim ruby

  {
    echo "$(dirname "$(mise which ruby)")"
    echo "$(dirname "$(mise which bundle)")"
    echo "$(dirname "$(mise which pod)")"
  } >> "$GITHUB_PATH"

  mise which ruby
  mise which bundle
  mise which pod
  xcodebuild -version
fi

if [[ "$PLATFORM" == "android" ]]; then
  ANDROID_HOME_VALUE="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
  if ! command -v sdkmanager >/dev/null 2>&1; then
    brew install --cask android-commandlinetools
  fi

  export ANDROID_HOME="$ANDROID_HOME_VALUE"
  export ANDROID_SDK_ROOT="$ANDROID_HOME_VALUE"
  export JAVA_HOME="$JAVA_HOME_VALUE"
  export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$JAVA_HOME/bin:$PATH"

  mkdir -p "$ANDROID_HOME"
  set +o pipefail
  yes | sdkmanager --licenses >/dev/null
  license_status=$?
  set -o pipefail
  if [[ "$license_status" -ne 0 && "$license_status" -ne 141 ]]; then
    echo "Failed to accept Android SDK licenses." >&2
    exit "$license_status"
  fi
  sdkmanager \
    "platform-tools" \
    "emulator" \
    "platforms;android-34" \
    "build-tools;34.0.0" \
    "system-images;android-34;google_apis;arm64-v8a"

  if ! avdmanager list avd | grep -q '^    Name: nitro-e2e-api-34$'; then
    echo no | avdmanager create avd \
      -n nitro-e2e-api-34 \
      -k "system-images;android-34;google_apis;arm64-v8a" \
      -d pixel_6 \
      --force
  fi

  {
    echo "$ANDROID_HOME/emulator"
    echo "$ANDROID_HOME/platform-tools"
    echo "$ANDROID_HOME/cmdline-tools/latest/bin"
  } >> "$GITHUB_PATH"

  {
    echo "ANDROID_HOME=$ANDROID_HOME"
    echo "ANDROID_SDK_ROOT=$ANDROID_SDK_ROOT"
  } >> "$GITHUB_ENV"

  adb version
  emulator -version
  sdkmanager --list_installed
  avdmanager list avd
fi
