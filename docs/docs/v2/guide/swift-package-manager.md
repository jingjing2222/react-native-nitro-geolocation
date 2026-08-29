---
title: Swift Package Manager
---

# Swift Package Manager

React Native 0.87 adds an experimental Swift Package Manager (SwiftPM) path for
iOS. `react-native-nitro-geolocation` supports that experiment through a
precompiled package containing both Nitro Modules and Nitro Geolocation.
CocoaPods remains the recommended production path while React Native marks
SwiftPM experimental.

## Compatibility

| iOS dependency manager | React Native | Nitro Modules | Status |
| --- | --- | --- | --- |
| CocoaPods | 0.75 or newer | Compatible installed version | Supported |
| SwiftPM-only | 0.87.x | 0.37.1 | Experimental |

The exact Nitro version matters because the SwiftPM artifact contains the
native Nitro runtime. The JavaScript package installed in the app must match
that binary. The autolinking plugin stops with an actionable error when either
React Native or Nitro is outside this matrix.

## Install with SwiftPM

Install the matching Nitro runtime and this package:

```bash
yarn add react-native-nitro-modules@0.37.1 react-native-nitro-geolocation@rc
```

Add the SwiftPM configuration helper to the app's `react-native.config.js`:

```js
const {
  withNitroGeolocationSwiftPM,
} = require("react-native-nitro-geolocation/spm");

module.exports = withNitroGeolocationSwiftPM({});
```

If the app already exports React Native configuration, pass that object to the
helper. It preserves the existing configuration and disables only the separate
iOS autolink target for `react-native-nitro-modules`. The Geolocation SwiftPM
product already contains that exact native runtime, so linking it again would
produce duplicate symbols.

Convert the iOS project with React Native's experimental command:

```bash
cd ios
npx react-native spm add --deintegrate --yes
```

After a fresh clone or dependency reset, run `npx react-native spm` once before
building. There is no `pod install` step on this path.

During setup, the package downloads the matching GitHub Release artifact,
verifies its SHA-256 sidecar, and exposes one `NitroGeolocation` product to
React Native's autolinker. The artifact contains device and simulator slices
for both `NitroModules.xcframework` and `NitroGeolocation.xcframework`.

## Boundaries

- Do not combine CocoaPods and SwiftPM products in one iOS target.
- Do not remove the configuration helper; doing so makes React Native attempt
  to scaffold Nitro's mixed Swift/C++ source target, which SwiftPM rejects.
- A SwiftPM build has no source fallback. The matching release artifact and
  checksum must be available.
- Other Nitro-based libraries need their own compatible SwiftPM integration.
  Do not link a second copy or a different version of the Nitro native runtime.
- React Native documents the 0.87 SwiftPM path as experimental and advises
  against production use. Revalidate Debug, Release, simulator, device, and
  runtime registration whenever upgrading React Native, Nitro, or Xcode.

To return to CocoaPods, run `npx react-native spm deinit`, remove the helper
from `react-native.config.js`, then reinstall pods.
