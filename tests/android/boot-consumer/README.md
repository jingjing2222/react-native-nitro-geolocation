# Android boot regression E2E

This APK consumes the actual `react-native-nitro-geolocation` Android project,
including its merged manifest, receivers, services, and compiled native code.
The fixture does not call the background API or initialize React Native. It
isolates the native boot path from JavaScript, which is not involved in #221.
It does not mock JobScheduler or manually call the receiver.

The test installs the APK, launches its activity once to clear Android's stopped
package state, returns to the home screen, and runs `adb reboot`. It verifies a
changed kernel boot ID and ActivityManager's process-start record naming the
production `NitroBootReceiver`. Only then does it check for app crashes, pending
jobs, and background database creation. A missing receiver delivery cannot pass.

The API 27 negative control builds the same fixture with the three boot/store
source files from the last unfixed release commit
`89704cfcc26e5dd0f2eebc40c6969b0aeca620a4` (2.0.2). These files are temporarily
replaced during the red build and restored on exit. All other inputs, including
the fixture and test script, are shared with the green build. A failed build or
test infrastructure error does not count as red: the runner requires the exact
`JobInfo` no-constraints exception from the production receiver after reboot.
The green APK must pass the same test. API 34 runs the green test as well.

## Run locally

Use an expendable emulator; physical devices are rejected. API 27 needs an x86
host/image. The scripts install/uninstall only `com.nitrogeolocation.boote2e`.

```sh
yarn install --immutable
REACT_NATIVE_ARCHITECTURES=x86 mise exec -- bash scripts/build-android-boot-e2e.sh
# Start an API 27 google_apis x86 emulator, then:
ANDROID_SERIAL=emulator-5554 bash scripts/test-android-boot-red-green.sh
```

For an ARM Mac with an API 34 emulator, set `BUILD_RED=0` on both commands and
`REACT_NATIVE_ARCHITECTURES=arm64-v8a` on the build command.

The `Android Boot E2E` workflow runs on relevant PR changes and uploads
`android-boot-api-27` / `android-boot-api-34` artifacts. Each contains APKs and their
SHA-256 hashes, tested/baseline SHAs, build logs, per-run JSON results, full and
crash logcat buffers, broadcast/job dumps, and screenshots. API 27 also includes
the exact red source diff. Artifact retention is 30 days.

This is native consumer/OS lifecycle coverage. It does not verify JavaScript
location APIs, GPS fixes, or persisted-geofence delivery; those have separate
unit and background long-run suites.
