---
title: Service Migration
---

# Service Migration

Apps that use `react-native-geolocation-service` should migrate directly to the
Modern API:

```ts
import {
  getCurrentPosition,
  requestLocationSettings,
  setConfiguration,
  unwatch,
  watchPosition
} from 'react-native-nitro-geolocation';
```

Do not migrate through `react-native-nitro-geolocation/compat`. The service
package exposes Android fused-provider and settings-dialog behavior that maps
more closely to Nitro Geolocation's Modern Android provider/settings API.

## Agent Skill

This repository ships an Agent Skills-compatible migration playbook for this
path:

```bash
npx skills add jingjing2222/react-native-nitro-geolocation --skill service-migration
```

The skill source is
[`skills/service-migration`](https://github.com/jingjing2222/react-native-nitro-geolocation/tree/main/skills/service-migration).

The bundled helper script can inventory and safely transform the first pass:

```bash
node <skill-dir>/scripts/migrate-geolocation-service.mjs --root <app-root> --inventory-only
node <skill-dir>/scripts/migrate-geolocation-service.mjs --root <app-root> --dry-run
```

If the app startup file is obvious, the script can also add the Modern startup
configuration:

```bash
node <skill-dir>/scripts/migrate-geolocation-service.mjs \
  --root <app-root> \
  --startup-file <app-root>/src/App.tsx
```

## Startup Configuration

Configure Nitro Geolocation once near app startup.

Normal `react-native-geolocation-service` migrations should explicitly use
Google Play Services fused location on Android:

```ts
setConfiguration({
  authorizationLevel: 'whenInUse',
  enableBackgroundLocationUpdates: false,
  locationProvider: 'playServices'
});
```

Use `locationProvider: 'android'` only when the legacy app intentionally used
`forceLocationManager: true` or the product requires Android `LocationManager`.

## API Mapping

| `react-native-geolocation-service` | Nitro Modern API |
| --- | --- |
| `Geolocation.getCurrentPosition(success, error, options)` | `getCurrentPosition(options)` |
| `Geolocation.watchPosition(success, error, options)` | `watchPosition(...)` or `useWatchPosition(...)` |
| `Geolocation.clearWatch(id)` | `unwatch(token)` |
| `Geolocation.stopObserving()` | `stopObserving()` |
| `requestAuthorization('whenInUse' \| 'always')` | `setConfiguration({ authorizationLevel })` plus `requestPermission()` |
| `accuracy: { android, ios }` | `accuracy: { android, ios }` |
| `enableHighAccuracy: true` | `accuracy: { android: 'high', ios: 'best' }` |
| `showLocationDialog: true` | `requestLocationSettings()` before the request |
| `forceLocationManager: true` | `setConfiguration({ locationProvider: 'android' })` |
| default fused provider intent | `setConfiguration({ locationProvider: 'playServices' })` |
| `position.mocked` | `GeolocationResponse.mocked` |
| `position.provider` | `GeolocationResponse.provider` |
| error code `-1`, `1`, `2`, `3`, `4`, `5` | `LocationErrorCode` |

`forceRequestLocation` has no direct Modern option. Preserve that fallback
behavior manually only after reviewing the intended UX.

## One-Shot Location

Prefer a Promise chain for mechanical migrations so the containing function does
not need to become `async` immediately.

```diff
- import Geolocation from 'react-native-geolocation-service';
+ import {
+   getCurrentPosition,
+   requestLocationSettings
+ } from 'react-native-nitro-geolocation';

  export function loadLocation(onSuccess, onError) {
-   Geolocation.getCurrentPosition(onSuccess, onError, {
-     enableHighAccuracy: true,
-     timeout: 15000,
-     maximumAge: 10000,
-     showLocationDialog: true
-   });
+   requestLocationSettings({
+     accuracy: { android: 'high', ios: 'best' }
+   })
+     .then(() =>
+       getCurrentPosition({
+         accuracy: { android: 'high', ios: 'best' },
+         timeout: 15000,
+         maximumAge: 10000
+       })
+     )
+     .then(onSuccess)
+     .catch(onError);
  }
```

Do not add `requestLocationSettings()` when the legacy call explicitly used
`showLocationDialog: false`.

When `showLocationDialog` was omitted, review the flow manually. The service
package default was `true`; Nitro Modern API requires an explicit settings flow.

## Watches

Use the low-level Modern watch API as the first safe target:

```diff
- const watchId = Geolocation.watchPosition(onPosition, onError, {
-   enableHighAccuracy: true,
-   distanceFilter: 10,
-   interval: 5000,
-   fastestInterval: 2000
- });
+ const watchToken = watchPosition(onPosition, onError, {
+   accuracy: { android: 'high', ios: 'best' },
+   distanceFilter: 10,
+   interval: 5000,
+   fastestInterval: 2000
+ });

- Geolocation.clearWatch(watchId);
+ unwatch(watchToken);
```

Upgrade to `useWatchPosition()` only when the watch is owned by a React function
component or custom hook and the existing callbacks do not contain
ordering-sensitive side effects such as analytics, navigation, mutation, or
debouncing.

## Permission Differences

Legacy `requestAuthorization()` can return `disabled`. Modern
`requestPermission()` returns permission status only:

```ts
const status = await requestPermission();
```

If the old code handled `disabled`, check device-level service state separately:

```ts
const servicesEnabled = await hasServicesEnabled();

if (!servicesEnabled) {
  showLocationServicesDisabledMessage();
  return;
}

const status = await requestPermission();
```

## Default Differences

Review call sites that omit options:

| Option | Service default | Nitro Modern default |
| --- | --- | --- |
| `getCurrentPosition.timeout` | `Infinity` | `600000` |
| `getCurrentPosition.maximumAge` | `Infinity` | `0` |
| `distanceFilter` | `100` | Review per API flow |
| `showLocationDialog` | `true` | No implicit dialog; call `requestLocationSettings()` |

For fresh user-facing location, choose explicit options such as:

```ts
await getCurrentPosition({
  accuracy: { android: 'high', ios: 'best' },
  maximumAge: 0,
  timeout: 15000
});
```

For cached UI, read cached state explicitly with `getLastKnownPosition()` and
then refresh if the product flow needs it.
