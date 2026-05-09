---
name: service-migration
description: Migrate React Native apps directly from react-native-geolocation-service to react-native-nitro-geolocation Modern API without using /compat. Use when replacing react-native-geolocation-service imports, installing Nitro packages, configuring the Android provider, converting callback APIs to Modern Promise/watch APIs, preserving service-specific options such as accuracy and provider metadata, and reporting manual-review sites for settings dialogs, forceRequestLocation, and default option differences.
---

# Geolocation Service Migration

Migrate directly to `react-native-nitro-geolocation`.

Do not use `react-native-nitro-geolocation/compat`.
Do not create intermediate compat imports.
Do not preserve `Geolocation` default-object usage unless the user explicitly
asks for a compatibility fallback.

## Workflow

1. Inspect `package.json`, lockfiles, and the worktree state.
2. Confirm `react-native-geolocation-service` is installed or imported.
3. Install `react-native-nitro-modules` and
   `react-native-nitro-geolocation`.
4. Refresh docs context when network is available:
   ```bash
   curl -fsSL https://react-native-nitro-geolocation.pages.dev/llms.txt
   curl -fsSL https://react-native-nitro-geolocation.pages.dev/llms-full.txt
   ```
   Use `llms.txt` as the index and `llms-full.txt` only for exact API names,
   option semantics, or examples. If the target app pins an older installed
   version, confirm APIs against that package's local types.
5. Search all service usages:
   ```bash
   rg "react-native-geolocation-service|Geolocation\\.|requestAuthorization|showLocationDialog|forceRequestLocation|forceLocationManager|mocked|provider|PLAY_SERVICE_NOT_AVAILABLE|SETTINGS_NOT_SATISFIED|INTERNAL_ERROR|PermissionsAndroid"
   ```
6. Insert or update one app-startup `setConfiguration()` call. Normal
   `react-native-geolocation-service` migrations should use
   `locationProvider: "playServices"`. Use `"android"` only when the legacy app
   intentionally used `forceLocationManager: true`.
7. Rewrite imports directly to named Modern API imports from
   `react-native-nitro-geolocation`.
8. Convert one-shot location calls to Promise chains first. Use `async`/`await`
   only when the surrounding function is already async or clearly safe to make
   async.
9. Convert watches to low-level `watchPosition` plus `unwatch` first.
10. Upgrade to `useWatchPosition` only for hook-safe React function components
    or custom hooks.
11. Convert explicit Android settings-dialog behavior from
    `showLocationDialog: true` to a `requestLocationSettings()` flow.
12. Remove `react-native-geolocation-service`.
13. Run detected validation commands.
14. Report semantic changes and manual-review sites.

## Bundled Script

Resolve `scripts/migrate-geolocation-service.mjs` relative to this
`SKILL.md`.

Run inventory first:

```bash
node <skill-dir>/scripts/migrate-geolocation-service.mjs --root <app-root> --inventory-only
```

Dry-run the direct Modern transform:

```bash
node <skill-dir>/scripts/migrate-geolocation-service.mjs --root <app-root> --dry-run
```

Optionally add startup configuration when the app startup file is obvious:

```bash
node <skill-dir>/scripts/migrate-geolocation-service.mjs \
  --root <app-root> \
  --startup-file <app-root>/src/App.tsx
```

The script is assistance, not a blind migration. It performs package-manager
detection, dependency install/remove commands, AST-based import/callsite
rewrites when Babel parser tooling is available, and a manual-review report.
If the target project lacks Babel parser/generator dependencies, rerun with
`--allow-tool-install` to install temporary codemod dependencies outside the
app.

## Hard Rules

- Never import from `react-native-nitro-geolocation/compat`.
- Never rewrite to `/compat` as an intermediate step.
- Prefer direct named Modern API imports.
- Configure `locationProvider: "playServices"` for normal
  `react-native-geolocation-service` migrations.
- Use `locationProvider: "android"` only when legacy code used
  `forceLocationManager: true` or the app explicitly requires Android
  `LocationManager`.
- Convert `enableHighAccuracy: true` to
  `accuracy: { android: "high", ios: "best" }` unless an explicit `accuracy`
  object already exists.
- Preserve explicit `accuracy`, `timeout`, `maximumAge`, `distanceFilter`,
  `interval`, `fastestInterval`, `useSignificantChanges`, and
  `showsBackgroundLocationIndicator`.
- Convert `showLocationDialog: true` to an explicit
  `requestLocationSettings()` flow.
- Do not auto-convert `forceRequestLocation`; report it.
- Do not introduce React hooks unless the file is a function component or
  custom hook and the call is at hook-safe top level.
- Use low-level `watchPosition` plus `unwatch` as the first safe Modern target.
- Replace numeric error-code checks with `LocationErrorCode` where possible.
- Do not remove `PermissionsAndroid` code unless it is clearly only for
  location permission and replaced by `requestPermission()`.

## API Mapping

| `react-native-geolocation-service` | Nitro Modern API | Notes |
| --- | --- | --- |
| `Geolocation.getCurrentPosition(success, error, options)` | `getCurrentPosition(options)` | Convert to Promise chain first. |
| `Geolocation.watchPosition(success, error, options)` | `watchPosition(...)` or `useWatchPosition(...)` | Start with low-level API. |
| `Geolocation.clearWatch(id)` | `unwatch(token)` | Token type changes. |
| `Geolocation.stopObserving()` | `stopObserving()` | Keep only when global cleanup was intended. |
| `requestAuthorization("whenInUse" | "always")` | `setConfiguration({ authorizationLevel })` plus `requestPermission()` | Return statuses differ. |
| `accuracy: { android, ios }` | `accuracy: { android, ios }` | Preserve explicit values. |
| `enableHighAccuracy` | `accuracy` preset | Prefer Modern `accuracy`. |
| `showLocationDialog` | `requestLocationSettings()` | Convert explicit `true`; report omitted defaults. |
| `forceLocationManager` | `setConfiguration({ locationProvider: "android" })` | Global setting, not a call option. |
| default fused provider intent | `setConfiguration({ locationProvider: "playServices" })` | Do this for normal service migrations. |
| `forceRequestLocation` | no direct option | Report and preserve intent manually. |
| `position.mocked` | `GeolocationResponse.mocked` | Available in Modern API. |
| `position.provider` | `GeolocationResponse.provider` | Available in Modern API. |
| error codes `-1`, `1`, `2`, `3`, `4`, `5` | `LocationErrorCode` | Prefer enum comparisons. |

## Transform Patterns

Rewrite imports directly:

```ts
import {
  getCurrentPosition,
  watchPosition,
  unwatch,
  stopObserving,
  requestPermission,
  setConfiguration,
  requestLocationSettings,
  LocationErrorCode,
} from "react-native-nitro-geolocation";
```

Convert one-shot calls to Promise chains:

```ts
getCurrentPosition({
  accuracy: { android: "high", ios: "best" },
  timeout: 15000,
  maximumAge: 10000,
})
  .then(onSuccess)
  .catch(onError);
```

Convert explicit Android settings-dialog behavior:

```ts
requestLocationSettings({
  accuracy: { android: "high", ios: "best" },
})
  .then(() =>
    getCurrentPosition({
      accuracy: { android: "high", ios: "best" },
      timeout: 15000,
    })
  )
  .then(onSuccess)
  .catch(onError);
```

Use low-level watches as the first safe target:

```ts
const watchToken = watchPosition(onPosition, onError, {
  accuracy: { android: "high", ios: "best" },
  distanceFilter: 10,
  interval: 5000,
  fastestInterval: 2000,
});

unwatch(watchToken);
```

Upgrade to `useWatchPosition` only when the watch is already owned by a React
function component or custom hook and the original callbacks do not contain
ordering-sensitive side effects.

## Manual Review Requirements

Always report these instead of guessing:

- Omitted `showLocationDialog`. Service default was `true`; Nitro requires an
  explicit `requestLocationSettings()` flow if the app wants the Android
  settings dialog.
- Omitted `timeout` or `maximumAge` on `getCurrentPosition`. Service defaults
  were effectively infinite; Nitro Modern defaults are `timeout: 600000` and
  `maximumAge: 0`.
- `forceRequestLocation`. Preserve the fallback behavior explicitly only after
  product/UX review.
- Mixed `forceLocationManager` usage. Nitro `locationProvider` is global.
- `requestAuthorization` code that handles `disabled`. Modern permission status
  does not include `disabled`; use `hasServicesEnabled()` or
  `getProviderStatus()` separately.
- `PermissionsAndroid` usage unless it is clearly redundant after
  `requestPermission()`.
- Watch callbacks with analytics, navigation, mutation, debouncing, or
  ordering-sensitive side effects.
- Class components, services, background tasks, and conditional branches where
  introducing hooks would break React rules.

## Validation

Use the target app's detected package manager and existing scripts. Prefer
`typecheck`, `lint`, and `test` when they exist. Do not invent missing scripts.
For device-sensitive behavior, verify at least one permission request, one
current-position request, one Android settings flow when applicable, and one
watch start/stop flow.
