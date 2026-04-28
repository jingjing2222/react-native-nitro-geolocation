#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

yarn android:release
maestro test --platform android .maestro/all-tests.yaml
