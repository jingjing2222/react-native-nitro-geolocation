# Agent Context Map

Use this map when you need code context for geolocation behavior but do not
need to read generated Nitro files, full app bundles, or every scenario screen.

## Start Here for This Task

Pick the smallest entry point that matches your change:

| Task | Read first | Then read |
| --- | --- | --- |
| Public foreground API behavior | `packages/react-native-nitro-geolocation/src/api/` | `packages/react-native-nitro-geolocation/src/NitroGeolocation.nitro.ts`, then platform files below |
| Community compatibility behavior | `packages/react-native-nitro-geolocation/src/compat/` | `packages/react-native-nitro-geolocation/src/NitroGeolocationCompat.nitro.ts` |
| Background API shape | `packages/react-native-nitro-geolocation/src/background/index.ts` | `packages/react-native-nitro-geolocation/src/background/NitroBackgroundLocation.nitro.ts` |
| Android foreground native bug | `packages/react-native-nitro-geolocation/android/src/main/java/com/margelo/nitro/nitrogeolocation/NitroGeolocation.kt` | Nearby Android helper for the specific feature |
| Android background native bug | `packages/react-native-nitro-geolocation/android/src/main/java/com/margelo/nitro/nitrogeolocation/NitroBackgroundLocation.kt` | `packages/react-native-nitro-geolocation/android/src/main/java/com/margelo/nitro/nitrogeolocation/background/` |
| iOS foreground native bug | `packages/react-native-nitro-geolocation/ios/NitroGeolocation.swift` | Nearby iOS helper for the specific feature |
| iOS background native bug | `packages/react-native-nitro-geolocation/ios/NitroBackgroundLocation.swift` | `IOSBackgroundLocationDelegate.swift`, `IOSBackgroundMotion.swift`, `IOSBackgroundHttpSync.swift` |
| E2E failure | Matching `examples/v0.81.1/.maestro/*.yaml` file | Matching `examples/v0.81.1/src/screens/*Screen.tsx` file |
| E2E shared UI or selectors | `examples/v0.81.1/src/screens/scenario/` | `examples/v0.81.1/src/App.tsx` for route names |

Avoid these until needed:

- `packages/react-native-nitro-geolocation/nitrogen/generated/**`: generated
  bindings. Read only to debug codegen output.
- `docs/doc_build/**`: generated documentation output.
- `examples/*/node_modules/**`: installed dependencies.
- Full scenario screen sweeps. Use the E2E map below to open only the failing
  flow and its screen.

## Native Responsibility Map

### Shared TypeScript Layer

| Area | Responsibility | Main files |
| --- | --- | --- |
| Modern foreground API | Public wrappers for current position, watch, permission, provider, geocoding, heading, settings, and availability APIs. | `src/api/`, `src/NitroGeolocation.nitro.ts` |
| Community compatibility API | `@react-native-community/geolocation`-style callbacks and configuration. | `src/compat/`, `src/NitroGeolocationCompat.nitro.ts` |
| Background API | Public background exports, listener narrowing, storage methods, geofence helpers, activity recognition helpers, HTTP sync helper, and task registration. | `src/background/index.ts`, `src/background/task.ts`, `src/background/types.ts`, `src/background/NitroBackgroundLocation.nitro.ts` |
| Web fallback | Browser geolocation behavior and web E2E support. | `src/web/`, `src/index.web.tsx`, `src/background/index.web.ts` |

### Android Foreground

| Responsibility | Main files |
| --- | --- |
| Nitro foreground module entry point | `android/src/main/java/com/margelo/nitro/nitrogeolocation/NitroGeolocation.kt` |
| Compatibility module entry point | `android/src/main/java/com/margelo/nitro/nitrogeolocation/NitroGeolocationCompat.kt` |
| One-shot current position | `GetCurrentPosition.kt`, `AndroidFusedRequestFactory.kt` |
| Position watch | `WatchPosition.kt`, `AndroidFusedRequestFactory.kt` |
| Permissions | `RequestAuthorization.kt` |
| Options and conversion | `AndroidGeolocationOptions.kt`, `AndroidGeolocationConversions.kt`, `LocationValues.kt` |
| Provider/settings/status | `AndroidLocationSettings.kt`, `AndroidGeolocationErrors.kt` |
| Heading | `AndroidHeadingManager.kt` |

### Android Background

| Responsibility | Main files |
| --- | --- |
| Nitro background module entry point | `android/src/main/java/com/margelo/nitro/nitrogeolocation/NitroBackgroundLocation.kt` |
| Background orchestration | `android/src/main/java/com/margelo/nitro/nitrogeolocation/background/NitroBackgroundLocationController.kt` |
| Foreground service tracking | `NitroBackgroundLocationService.kt`, `NitroBackgroundNotificationFactory.kt` |
| Location delivery from system callbacks | `NitroLocationUpdateReceiver.kt` |
| Event fan-out to JS listeners | `NitroBackgroundEventHub.kt` |
| Native persistence | `NitroBackgroundStore.kt`, `AndroidBackgroundSerialization.kt` |
| Background permission contract | `AndroidBackgroundPermissions.kt` |
| Geofencing | `NitroGeofenceReceiver.kt` |
| Android Headless JS | `NitroBackgroundHeadlessTaskService.kt` |
| Start on boot | `NitroBootReceiver.kt` |
| Activity recognition | `NitroActivityRecognitionReceiver.kt` |
| HTTP sync | `AndroidBackgroundHttpSync.kt` |

### iOS Foreground

| Responsibility | Main files |
| --- | --- |
| Nitro foreground module entry point | `ios/NitroGeolocation.swift` |
| Compatibility module entry point | `ios/NitroGeolocationCompat.swift` |
| Core Location manager and delegate | `ios/LocationManager.swift`, `ios/IOSGeolocationDelegate.swift` |
| Options and conversion | `ios/IOSGeolocationOptions.swift`, `ios/IOSGeolocationConversions.swift` |
| Error mapping | `ios/IOSGeolocationErrors.swift` |
| Mock/provider metadata | `ios/CLLocation+GeolocationMetadata.swift` |

### iOS Background

| Responsibility | Main files |
| --- | --- |
| Nitro background module, storage, status, geofences, and Core Location start/stop | `ios/NitroBackgroundLocation.swift` |
| Background Core Location delegate | `ios/IOSBackgroundLocationDelegate.swift` |
| Activity recognition conversion | `ios/IOSBackgroundMotion.swift` |
| Native HTTP sync | `ios/IOSBackgroundHttpSync.swift` |
| Persistence serialization | `ios/IOSBackgroundSerialization.swift` |

## E2E Scenario File Map

All native E2E flows live in `examples/v0.81.1/.maestro/`. Route names and deep
links live in `examples/v0.81.1/src/App.tsx`. Shared selectors, result blocks,
permission helpers, and location assertions live in
`examples/v0.81.1/src/screens/scenario/`.

| Flow | Maestro file | App screen |
| --- | --- | --- |
| Master native smoke suite | `all-tests.yaml` | Multiple screens |
| Permission check/request | `permission-check.yaml` | `PermissionCheckScreen.tsx` |
| Current position | `current-position.yaml` | `CurrentPositionScreen.tsx` |
| Watch position | `watch-position.yaml` | `WatchPositionScreen.tsx` |
| Location simulation | `location-simulation.yaml` | `LocationSimulationScreen.tsx` |
| Accuracy presets | `accuracy-presets.yaml` | `AccuracyPresetsScreen.tsx` |
| Last known position | `last-known-position.yaml` | `LastKnownPositionScreen.tsx` |
| Geocoding and reverse geocoding | `geocoding.yaml` | `GeocodingScreen.tsx` |
| Location availability | `location-availability.yaml` | `LocationAvailabilityScreen.tsx` |
| Heading dispatcher | `heading.yaml` | `HeadingScreen.tsx` |
| Android heading | `heading-android.yaml` | `HeadingScreen.tsx` |
| iOS heading | `heading-ios.yaml` | `HeadingScreen.tsx` |
| Android request options | `android-request-options.yaml` | `AndroidRequestOptionsScreen.tsx` |
| Android provider settings | `provider-settings.yaml`, `provider-settings-not-ready.yaml` | `ProviderSettingsScreen.tsx` |
| iOS location tuning | `ios-location-tuning.yaml` | `IOSLocationTuningScreen.tsx` |
| iOS accuracy authorization | `ios-accuracy-authorization.yaml` | `IOSAccuracyAuthorizationScreen.tsx` |
| iOS release bridge options | `ios-release-options-bridge.yaml` | `IOSReleaseOptionsBridgeScreen.tsx` |
| Issue 67 coarse Android location | `issue-67-android-coarse-location.yaml` | `Issue67Screen.tsx` |
| Background API smoke | `background-e2e.yaml` | `BackgroundE2EScreen.tsx` |
| Android long-run background | `background-long-run-android.yaml` | `LongRunBackgroundE2EScreen.tsx`, `backgroundLongRunTask.ts` |
| Android long-run reboot arming | `background-long-run-android-arm-reboot.yaml` | `LongRunBackgroundE2EScreen.tsx` |
| Android long-run reboot proof | `background-long-run-android-reboot.yaml` | `LongRunBackgroundE2EScreen.tsx`, `backgroundLongRunTask.ts` |
| iOS long-run background | `background-long-run-ios.yaml` | `LongRunBackgroundE2EScreen.tsx` |
| Mocked metadata Android true | `mocked-metadata-android-true.yaml` | `MockedMetadataScreen.tsx` |
| Mocked metadata Android false | `mocked-metadata-android-false.yaml` | `MockedMetadataScreen.tsx` |
| Mocked metadata iOS true | `mocked-metadata-ios-true.yaml` | `MockedMetadataScreen.tsx` |
| Mocked metadata iOS false | `mocked-metadata-ios-false.yaml` | `MockedMetadataScreen.tsx` |
| API errors | `api-errors.yaml` | `ApiErrorsScreen.tsx` |
| Community compatibility API | `compat-api.yaml` | `CompatScreen.tsx` |
| Web E2E available path | `web-e2e.yaml` | `WebE2EScreen.tsx`, `examples/web-e2e/` |
| Web E2E unavailable path | `web-e2e-unavailable.yaml` | `WebE2EScreen.tsx`, `examples/web-e2e/` |

## E2E Command Map

Run from repo root with the matching workspace script:

| Target | Command |
| --- | --- |
| Android native smoke suite | `yarn workspace react-native-nitro-geolocation-example test:e2e:android` |
| iOS native smoke suite | `yarn workspace react-native-nitro-geolocation-example test:e2e:ios` |
| Android long-run background | `yarn workspace react-native-nitro-geolocation-example test:e2e:background-long-run:android` |
| Android long-run background with reboot | `RUN_REBOOT=1 yarn workspace react-native-nitro-geolocation-example test:e2e:background-long-run:android` |
| iOS long-run background | `yarn workspace react-native-nitro-geolocation-example test:e2e:background-long-run:ios` |
| Android web E2E | `yarn workspace react-native-nitro-geolocation-example test:e2e:web:android` |
| iOS web E2E | `yarn workspace react-native-nitro-geolocation-example test:e2e:web:ios` |
