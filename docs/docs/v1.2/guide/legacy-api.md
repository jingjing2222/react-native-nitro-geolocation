---
title: Legacy API (Compatibility)
---

> ⚠️ **This is the legacy callback-based API for compatibility with @react-native-community/geolocation.**
> For new projects, we recommend using the [Modern API](./modern-api.md) with Hooks and Provider.

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

## 100% API Compatibility

This API is a **drop-in replacement** for `@react-native-community/geolocation`.
All methods work identically.

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
- `locationProvider` (string, Android-only) - Either `"playServices"`, `"android"`, or `"auto"`.  Determines wether to use `Google’s Location Services API` or `Android’s Location API`. The `"auto"` mode defaults to `android`, and falls back to Android's Location API if play services aren't available.

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
