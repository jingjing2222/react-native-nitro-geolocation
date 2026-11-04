# Issue 224: pre-granted permission and modern background watch

Run from the repository root after building the **Release** example from source:

```sh
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
export IOS_UDID=<booted-iPhone-simulator-UDID>
xcodebuild \
  -workspace examples/v0.81.1/ios/NitroGeolocationExample.xcworkspace \
  -scheme NitroGeolocationExample -configuration Release -sdk iphonesimulator \
  -destination "id=$IOS_UDID" -derivedDataPath /tmp/nitro-issue224-build \
  ONLY_ACTIVE_ARCH=YES CODE_SIGNING_ALLOWED=NO
export IOS_APP_PATH=/tmp/nitro-issue224-build/Build/Products/Release-iphonesimulator/NitroGeolocationExample.app
export EVIDENCE_DIR="$PWD/evidence/issue-224-e2e"
yarn workspace react-native-nitro-geolocation-example test:e2e:issue-224:ios
```

Requires Xcode, installed CocoaPods dependencies, Node, and Maestro. The test
reinstalls the example with clean data, so do not use a simulator whose example
app data you need to retain. The dedicated iOS E2E workflow also runs this test.

The Node test runner coordinates the real app through the Maestro flows in this
folder. It grants Always permission before a cold launch, checks the permission
before `requestPermission()`, and verifies a foreground `watchPosition` callback.
It presses Home, waits 20 seconds for the normal background grace period to
expire, and injects two distinct CoreLocation coordinates ten seconds apart.

Each actual JS watch callback reports its coordinate, measurement timestamp,
callback timestamp, and AppState to a temporary loopback collector. The runner
requires both fresh route points in order **before bringing the app back**. The
verdict is frozen before the verify flow starts. Buffered callbacks delivered on
resume cannot turn a failure into a pass. No mocked locations in the JS layer,
separate `/background` tracking, debugger, background task, or app polling timer
is used. Only the simulator's GPS source is controlled.

The test writes `proof.json`, Maestro logs, `result.png`, and
`watch-background.mp4` to `EVIDENCE_DIR`. A failure exits nonzero.

For RED/GREEN, build the same app and run the same test with the baseline
`NitroGeolocation.swift` from `21f93cb`, then rebuild with the fix. Keep all test
files identical between the two runs. The small host Swift contract remains a
separate unit test, not the evidence for this E2E.
