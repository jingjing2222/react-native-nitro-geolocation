#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

yarn ios:release
maestro test --platform ios .maestro/all-tests.yaml
