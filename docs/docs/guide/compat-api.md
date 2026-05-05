---
title: Compat API (Compatibility)
---

> ⚠️ **This is the compat callback-based API for compatibility with @react-native-community/geolocation.**
> For new projects, we recommend using the [Modern API](./modern-api.md) with functions and the `useWatchPosition` hook.

## Import Path

```tsx
// Import from /compat subpath
import Geolocation from 'react-native-nitro-geolocation/compat';

// Or named imports
import {
  getCurrentPosition,
  watchPosition,
  clearWatch,
} from 'react-native-nitro-geolocation/compat';
```

## Compatibility Scope

This API is drop-in compatible with the core native
`@react-native-community/geolocation` surface. It preserves the callback-based
shape for existing iOS and Android apps while the Modern API gives new code a
Promise/function API.

| Community API | Nitro `/compat` | Notes |
| --- | ---: | --- |
| `setRNConfiguration` | Supported | Android `auto` currently maps to the platform provider; set `playServices` explicitly for fused location. |
| `requestAuthorization` | Supported | iOS authorization follows configured `Info.plist` keys and `authorizationLevel`. |
| `getCurrentPosition` | Supported | Keeps the legacy callback and error shape. |
| `watchPosition` | Supported | Returns a numeric watch id. |
| `clearWatch` | Supported | Clears a watch id from `watchPosition`. |
| `stopObserving` | Supported | Preserved for legacy cleanup compatibility. |
| `navigator.geolocation` polyfill | Not supported in `v1.2.x` | Planned for `v1.3`. |
| Web | Not supported in `v1.2.x` | Planned as a `/compat` browser fallback in `v1.3`. |

The community package supports web by delegating to the browser
`navigator.geolocation` API. `react-native-nitro-geolocation` currently targets
native Nitro bindings and does not include that browser fallback in `v1.2.x`.

## Summary

- [`setRNConfiguration`](#setrnconfiguration)
- [`requestAuthorization`](#requestauthorization)
- [`getCurrentPosition`](#getcurrentposition)
- [`watchPosition`](#watchposition)
- [`clearWatch`](#clearwatch)
- [`stopObserving`](#stopobserving)

## Details

### `setRNConfiguration()`

Sets configuration options that will be used in all location requests.

```ts
Geolocation.setRNConfiguration(config: {
  skipPermissionRequests: boolean;
  authorizationLevel?: 'always' | 'whenInUse' | 'auto';
  enableBackgroundLocationUpdates?: boolean;
  locationProvider?: 'playServices' | 'android' | 'auto';
});
```

Supported options:

- `skipPermissionRequests` (boolean) - Defaults to `false`. If `true`, you must request permissions before using Geolocation APIs.
- `authorizationLevel` (string, iOS-only) - Either `"whenInUse"`, `"always"`, or `"auto"`. Changes whether the user will be asked to give "always" or "when in use" location services permission. Any other value or `auto` will use the default behaviour, where the permission level is based on the contents of your `Info.plist`.
- `enableBackgroundLocationUpdates` (boolean, iOS-only) - When using `skipPermissionRequests`, toggle wether to automatically enableBackgroundLocationUpdates. Defaults to true.
- `locationProvider` (string, Android-only) - Either `"playServices"`, `"android"`, or `"auto"`. Determines whether to use Google Play Services location APIs or Android's platform `LocationManager`. The `"auto"` mode currently defaults to Android's platform provider; set `"playServices"` explicitly to use Google Play Services when available.

### `requestAuthorization()`

Request suitable Location permission.

```ts
Geolocation.requestAuthorization(
  success?: () => void,
  error?: (error: {
    code: number;
    message: string;
    PERMISSION_DENIED: number;
    POSITION_UNAVAILABLE: number;
    TIMEOUT: number;
  }) => void
);
```

On iOS if NSLocationAlwaysUsageDescription is set, it will request Always authorization, although if NSLocationWhenInUseUsageDescription is set, it will request InUse authorization.

### `getCurrentPosition()`

Invokes the success callback once with the latest location info.

```ts
Geolocation.getCurrentPosition(
  success: (position: {
    coords: {
      latitude: number;
      longitude: number;
      altitude: number | null;
      accuracy: number;
      altitudeAccuracy: number | null;
      heading: number | null;
      speed: number | null;
    };
    timestamp: number;
  }) => void,
  error?: (error: {
    code: number;
    message: string;
    PERMISSION_DENIED: number;
    POSITION_UNAVAILABLE: number;
    TIMEOUT: number;
  }) => void,
  options?: {
    timeout?: number;
    maximumAge?: number;
    enableHighAccuracy?: boolean;
  }
);
```

Supported options:

- `timeout` (ms) - Is a positive value representing the maximum length of time (in milliseconds) the device is allowed to take in order to return a position. Defaults to 10 minutes.
- `maximumAge` (ms) - Is a positive value indicating the maximum age in milliseconds of a possible cached position that is acceptable to return. If set to 0, it means that the device cannot use a cached position and must attempt to retrieve the real current position. If set to Infinity the device will always return a cached position regardless of its age. Defaults to INFINITY.
- `enableHighAccuracy` (bool) - Is a boolean representing if to use GPS or not. If set to true, a GPS position will be requested. If set to false, a WIFI location will be requested.

### `watchPosition()`

Invokes the success callback whenever the location changes. Returns a `watchId` (number).

```ts
Geolocation.watchPosition(
  success: (position: {
    coords: {
      latitude: number;
      longitude: number;
      altitude: number | null;
      accuracy: number;
      altitudeAccuracy: number | null;
      heading: number | null;
      speed: number | null;
    };
    timestamp: number;
  }) => void,
  error?: (error: {
    code: number;
    message: string;
    PERMISSION_DENIED: number;
    POSITION_UNAVAILABLE: number;
    TIMEOUT: number;
  }) => void,
  options?: {
    interval?: number;
    fastestInterval?: number;
    timeout?: number;
    maximumAge?: number;
    enableHighAccuracy?: boolean;
    distanceFilter?: number;
    useSignificantChanges?: boolean;
  }
) => number;
```

Supported options:

- `interval` (ms) -- (Android only) The rate in milliseconds at which your app prefers to receive location updates. Note that the location updates may be somewhat faster or slower than this rate to optimize for battery usage, or there may be no updates at all (if the device has no connectivity, for example).
- `fastestInterval` (ms) -- (Android only) The fastest rate in milliseconds at which your app can handle location updates. Unless your app benefits from receiving updates more quickly than the rate specified in `interval`, you don't need to set it.
- `timeout` (ms) - Is a positive value representing the maximum length of time (in milliseconds) the device is allowed to take in order to return a position. Defaults to 10 minutes.
- `maximumAge` (ms) - Is a positive value indicating the maximum age in milliseconds of a possible cached position that is acceptable to return. If set to 0, it means that the device cannot use a cached position and must attempt to retrieve the real current position. If set to Infinity the device will always return a cached position regardless of its age. Defaults to INFINITY.
- `enableHighAccuracy` (bool) - Is a boolean representing if to use GPS or not. If set to true, a GPS position will be requested. If set to false, a WIFI location will be requested.
- `distanceFilter` (m) - The minimum distance from the previous location to exceed before returning a new location. Set to 0 to not filter locations. Defaults to 100m.
- `useSignificantChanges` (bool) - Uses the battery-efficient native significant changes APIs to return locations. Locations will only be returned when the device detects a significant distance has been breached. Defaults to FALSE.

### `clearWatch()`

Clears watch observer by id returned by `watchPosition()`

```ts
Geolocation.clearWatch(watchID: number);
```
