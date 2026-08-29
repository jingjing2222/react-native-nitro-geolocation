# React Native 0.87.1 SwiftPM example

This app is the checked-in consumer fixture for the experimental React Native
0.87 Swift Package Manager integration. It pins:

- React Native 0.87.1
- Nitro Modules 0.37.1
- the workspace copy of `react-native-nitro-geolocation`

The app imports `checkPermission` so Release bundling verifies the JavaScript
entry point, while the native CI builds verify that the two checksum-protected
XCFrameworks resolve and link.

Run the authoritative clean-room check from the repository root:

```bash
scripts/test-spm-rn087.sh build/prebuilt
```

That check copies this fixture to a temporary directory, installs the npm-packed
library, source-builds the matching binary artifacts, scaffolds other compatible
community packages, removes CocoaPods integration, and builds Debug simulator,
Release simulator, and Release device destinations through SwiftPM.

For a published version whose release contains the matching SwiftPM artifact:

```bash
yarn install
cd examples/v0.87.1/ios
npx react-native spm scaffold --deintegrate --yes
```

React Native still marks this integration experimental. Do not combine the
CocoaPods and SwiftPM products in the same iOS target.
