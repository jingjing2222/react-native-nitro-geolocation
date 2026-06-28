# react-native-nitro-geolocation

## 1.4.2

### Patch Changes

- 7a3f42a: Use the mise-managed Node.js 24.18.0 toolchain in CI.
- d08cf25: Update `react-native-nitro-modules` to 0.35.10 and regenerate Nitrogen bindings.
- 1f85a01: Publish Android AAR and iOS XCFramework prebuilt assets to GitHub Releases and use matching prebuilts during native installs when available.

## 1.4.1

### Patch Changes

- 9c1682f: Skip Android Headless JS dispatch when a live background listener already received the foreground-service event.

  This prevents React Native from warning `No task registered for key NitroBackgroundLocationTask` on every Android background location update when apps use foreground-service tracking without registering a Headless JS task.

## 1.4.0

### Minor Changes

- 09a735d: Add a `diagnoseBackgroundLocation()` helper and its `BackgroundLocationDiagnosis` type.

  When the background pipeline is silent, it inspects the current status and returns human-readable, actionable reasons delivery may not be working — a recorded native error, missing foreground/background permission, disabled location services, a service that is configured but not running, or running with no fix yet — without callers having to interpret the raw status object. Returns `{ healthy, status, issues }`.

  Also drops the internal `undefined as any` casts in the background bridge so the public typings flow through unchanged.

## 1.3.3

### Patch Changes

- 414ab7d: Repair and harden the Android background location pipeline, plus iOS parity fixes.

  - Android delivery: make the fused callback `PendingIntent` mutable so the OS dispatches location updates; start the foreground service with an explicit `location` type and handle start failures; guard headless task dispatch against background-start rejection; report `RUNNING` only after updates register; stop swallowing service-startup and per-listener failures and surface them via `lastError`.
  - Android hardening: run HTTP sync on a shared executor instead of a thread per location, with exponential backoff + jitter and connection draining; enable WAL on the store; isolate background event listeners so one failure does not drop the rest; run boot-resume off the broadcast main thread; add tagged logging.
  - Store cap contract (`maxStoredLocations` / `maxStoredEvents`), applied consistently on Android and iOS:
    - unset → use the native default safety cap
    - `0` or negative → unbounded storage
    - positive value → explicit cap
  - iOS parity: ignore transient `kCLErrorLocationUnknown` in the background delegate.

## 1.3.2

### Patch Changes

- a4e769a: Fix Android requestPermission prompting from a denied initial state and avoid requesting iOS Motion & Fitness permission when background motion tracking was not started.

## 1.3.1

### Patch Changes

- 3244af3: Fix Android foreground service background location startup requiring background location permission.
- 4d234ea: Add README guidance for the Rozenite DevTools plugin.

## 1.3.0

### Minor Changes

- 8216b3d: Add Compat API web support through a browser conditional export backed by `navigator.geolocation`.
- 104417c: Prefer Google Play Services fused location for Android `auto` and `playServices` provider configuration, with Android platform provider fallback when fused location is unavailable or cannot start. Keep explicit `android` provider configuration on the platform `LocationManager` path.
- 16681aa: Add Modern API web support through a browser conditional export backed by `navigator.geolocation`.
- b90c38b: Add a dedicated `./background` API with native-storage-backed background location tracking, geofencing, activity recognition events, Headless JS delivery, HTTP sync, documentation, and E2E examples.

### Patch Changes

- 7651df9: Refresh release documentation and simplify first-run guidance without changing
  package runtime behavior.
- f8b9060: Add repository dead-code guardrails, clean stale package metadata, and remove confirmed unused example/native code. The web implementation now keeps browser helpers, watch state, and the React hook in separate modules while preserving the public API surface.
- 73dafb9: Split native geolocation adapters, background controllers, and E2E scenario runners into focused helper modules, and add source line-count guardrails plus an agent context map for future maintenance.

## 1.2.6

### Patch Changes

- 1e398d1: Document scoped migration skills for community geolocation and geolocation-service migrations.

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
