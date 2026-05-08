# react-native-nitro-geolocation

## 1.2.5

### Patch Changes

- 86d80e4: Add `sideEffects: false` to enable tree shaking in bundlers.
- b6dc32a: Fix an iOS Release issue where location request options could be dropped while bridging optional options structs through Nitro's Swift bridge.

## 1.2.4

### Patch Changes

- a282f25: Fix iOS heading firehose: default `headingFilter` to 1° (Apple's documented default) instead of 0°.

  Before this fix, callers who didn't supply `headingFilter` (or whose options didn't reach native) hit `kCLHeadingFilterNone` (-1) — every CLHeading tick fired the success callback, producing sub-degree firehose updates on a stationary device.

## 1.2.3

### Patch Changes

- e8dec33: Fix iOS build error caused by ambiguous `abs` overload in `angularDistance`. Qualify with `Swift.abs(...)` so the compiler picks the generic signed-numeric overload instead of conflicting with Foundation's `fabs`.

## 1.2.2

### Patch Changes

- a1f42d6: Improve launch-readiness docs and npm metadata with clearer positioning,
  compatibility coverage, Android reliability guidance, Expo development build
  notes, benchmark scope, and migration/Directory preparation guides.

## 1.2.1

### Patch Changes

- 043e788: Clarify that Android `locationProvider: "auto"` currently uses the platform `LocationManager` by default, while `playServices` explicitly opts into Google Play Services fused location.
- 3842d7a: Add an Agent Skills-compatible Modern API migration playbook with a package-manager-aware compat bootstrap script for migrations from legacy geolocation APIs.

## 1.2.0

### Minor Changes

- efc25f1: Add platform-specific accuracy presets to the Modern API while preserving `enableHighAccuracy`.
  Android now supports `high`, `balanced`, `low`, and `passive` presets, and iOS supports Core Location accuracy presets including `bestForNavigation`, `nearestTenMeters`, and `reduced`.
  `enableHighAccuracy` is now deprecated for the Modern API in favor of explicit accuracy presets.
- 93c2ce2: Add Android provider/settings APIs to the Modern API: `hasServicesEnabled()`, `getProviderStatus()`, and `requestLocationSettings(options?)`. Android now checks native provider state and uses Google Play Services `SettingsClient` to show the system settings resolution dialog when high-accuracy location requirements are not satisfied.
- d54aa44: Add optional `mocked` and `provider` metadata to root location responses with Android and iOS native mappings.
  Add `GeolocationConfiguration` as the preferred root API configuration type while preserving `ModernGeolocationConfiguration` as a deprecated compatibility alias.
  Keep the Compat API response shape unchanged for the drop-in replacement contract.
  Normalize missing native coordinate values to explicit `null` unions and include the same metadata in Rozenite DevTools mock responses.
- 5bd6b3e: Add `geocode(address)` and `reverseGeocode(coords)` to the Modern API, backed by Android `Geocoder` and iOS `CLGeocoder` in the same package.
- cca38f3: Add explicit cached-position access with `getLastKnownPosition(options?)`, iOS location tuning options, and precise/reduced accuracy authorization APIs.
- 48e70a6: Add `getLocationAvailability()`, heading APIs (`getHeading()` and `watchHeading()`), and selected Android request controls for granularity, accurate initial updates, update age/delay, and maximum watch updates.
- b5efa00: Extend the Modern API location error contract with `INTERNAL_ERROR`, `PLAY_SERVICE_NOT_AVAILABLE`, and `SETTINGS_NOT_SATISFIED`. Native code now sends structured `{ code, message }` error classification directly to both callbacks and public Promise rejections, while preserving the `/compat` legacy error shape.
- a27ca39: Avoid blocking the UI thread when Android resolves provider status after a successful location settings request by checking Google Location Accuracy asynchronously.

### Patch Changes

- dd45dda: Align release validation documentation with the v1.2 native geolocation flows and use a deterministic geocoding fixture in examples.

## 1.1.4

### Patch Changes

- f1ec8fb: Add README to the npm package.

## 1.1.3

### Patch Changes

- b84154b: Guard geolocation devtools activation behind React Native `__DEV__`.

## 1.1.2

### Patch Changes

- 93d92a0: fix: Android coarse-only location handling

## 1.1.1

### Patch Changes

- 2d30232: Change the package license to MIT.

## 1.1.0

### Minor Changes

- 322af9c: Update the package for Nitro Modules 0.35.

  - Regenerate `nitrogen/generated/**` with Nitro 0.35-compatible bindings
  - Update Android JNI bootstrap to use `facebook::jni::initialize(...)` and `registerAllNatives()`
  - Relax the `react-native-nitro-modules` peer dependency range to `*`

## 1.0.0

### Major Changes

- 2e9da67: feat: E2E, unlicense license

## 0.5.0

### Minor Changes

- ebda398: feat: devtools
- 37c6d36: docs: devtools package name

### Patch Changes

- 0c7b851: docs: delete comming soon

## 0.4.0

### Minor Changes

- 1e5c2a1: feat: change API hook to functon

## 0.3.0

### Minor Changes

- bd454a9: docs: update

### Patch Changes

- c8f4d44: feat: stateless

## 0.2.0

### Minor Changes

- 4691c54: feat: version update for nitro-modules (0.29.6 -> 0.32.0)
- 52ae0d1: feat: modern style API
- f20e92f: docs: update
- a628093: chore: type alias variant_nulltype_double
- db27c99: feat: origin method to compat(drop in)

## 0.1.2

### Patch Changes

- 4751d9e: delete README.md
- 9340af5: improve IOS performance - delete queueing in delegate, use pure loginc
