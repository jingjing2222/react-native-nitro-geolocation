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
| `setRNConfiguration` | Supported | Preserves the legacy config method; Android provider selection is handled by the Modern API root import. |
| `requestAuthorization` | Supported | iOS authorization follows configured `Info.plist` keys and `authorizationLevel`. |
| `getCurrentPosition` | Supported | Keeps the legacy callback and error shape. |
| `watchPosition` | Supported | Returns a numeric watch id. |
| `clearWatch` | Supported | Clears a watch id from `watchPosition`. |
| `stopObserving` | Supported | Preserved for legacy cleanup compatibility. |
| `navigator.geolocation` polyfill | Not supported | Import `/compat` directly instead of installing a global polyfill. |
| Web | Supported | Browser builds use `navigator.geolocation` for `getCurrentPosition`, `watchPosition`, `clearWatch`, and `stopObserving`. |

The root Modern API and `/compat` subpath both support web by delegating to the
browser `navigator.geolocation` API. The `/compat` web entry keeps the callback
shape and legacy error constants, while `setRNConfiguration()` is a no-op and
`requestAuthorization()` calls the success callback immediately because browsers
do not expose a standalone geolocation authorization prompt.

## Summary

- [`setRNConfiguration`](#setrnconfiguration)
- [`requestAuthorization`](#requestauthorization)
- [`getCurrentPosition`](#getcurrentposition)
- [`watchPosition`](#watchposition)
- [`clearWatch`](#clearwatch)
- [`stopObserving`](#stopobserving)

## Details

### `setRNConfiguration()`

Preserves the legacy configuration API. Use it for iOS authorization/background
settings. Android provider selection and request behavior should be configured
per call or through the Modern API root import.

```ts
Geolocation.setRNConfiguration(config: {
  skipPermissionRequests: boolean;
  authorizationLevel?: 'always' | 'whenInUse' | 'auto';
  enableBackgroundLocationUpdates?: boolean;
  locationProvider?: 'playServices' | 'android' | 'auto';
});
```

Supported options:

- `skipPermissionRequests` (boolean) - Required by the public type. Pass `false` for legacy compatibility, or `true` when you request permissions yourself before using Geolocation APIs. For deterministic app flows, request permissions explicitly before calling location APIs.
- `authorizationLevel` (string, iOS-only) - Either `"whenInUse"`, `"always"`, or `"auto"`. Changes whether the user will be asked to give "always" or "when in use" location services permission. Any other value or `auto` will use the default behaviour, where the permission level is based on the contents of your `Info.plist`.
- `enableBackgroundLocationUpdates` (boolean, iOS-only) - When using `skipPermissionRequests`, toggles whether to enable Core Location background updates. Defaults to false unless explicitly set.
- `locationProvider` (string, Android-only) - Either `"playServices"`, `"android"`, or `"auto"`. Preserved for API compatibility on `/compat`; use the Modern API root import when you need Android fused/provider selection.

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
    accuracy?: {
      android?: 'high' | 'balanced' | 'low' | 'passive';
      ios?: 'bestForNavigation' | 'best' | 'nearestTenMeters' | 'hundredMeters' | 'kilometer' | 'threeKilometers' | 'reduced';
    };
    activityType?: 'other' | 'automotiveNavigation' | 'fitness' | 'otherNavigation' | 'airborne';
    pausesLocationUpdatesAutomatically?: boolean;
    showsBackgroundLocationIndicator?: boolean;
  }
);
```

Supported options:

- `timeout` (ms) - Is a positive value representing the maximum length of time (in milliseconds) the device is allowed to take in order to return a position. Native compat defaults to 10 minutes. Web omits the field when you do not pass it, so browser defaults apply.
- `maximumAge` (ms) - Is a positive value indicating the maximum age in milliseconds of a possible cached position that is acceptable to return. Native compat defaults to INFINITY. Web omits the field when you do not pass it, so browser defaults apply.
- `enableHighAccuracy` (bool) - Is a boolean representing if to use GPS or not. If set to true, a GPS position will be requested. If set to false, a WIFI location will be requested.
- `accuracy` - Native-only platform-specific accuracy preset. On iOS and Android, it takes precedence over `enableHighAccuracy` when supplied for the current platform. On web, `/compat` forwards only `enableHighAccuracy`, `timeout`, and `maximumAge` to `navigator.geolocation`.
- `activityType` (iOS only) - Core Location activity type.
- `pausesLocationUpdatesAutomatically` (iOS only) - Core Location automatic pause behavior.
- `showsBackgroundLocationIndicator` (iOS only) - Shows the iOS background location indicator when the app has background location capability and permission.

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
    accuracy?: {
      android?: 'high' | 'balanced' | 'low' | 'passive';
      ios?: 'bestForNavigation' | 'best' | 'nearestTenMeters' | 'hundredMeters' | 'kilometer' | 'threeKilometers' | 'reduced';
    };
    distanceFilter?: number;
    useSignificantChanges?: boolean;
    activityType?: 'other' | 'automotiveNavigation' | 'fitness' | 'otherNavigation' | 'airborne';
    pausesLocationUpdatesAutomatically?: boolean;
    showsBackgroundLocationIndicator?: boolean;
  }
) => number;
```

Supported options:

- `interval` (ms) -- (Android only) The rate in milliseconds at which your app prefers to receive location updates. Note that the location updates may be somewhat faster or slower than this rate to optimize for battery usage, or there may be no updates at all (if the device has no connectivity, for example).
- `enableHighAccuracy` (bool) - Is a boolean representing if to use GPS or not. If set to true, a GPS position will be requested. If set to false, a WIFI location will be requested.
- `accuracy` - Native-only platform-specific accuracy preset. On iOS and Android, it takes precedence over `enableHighAccuracy` when supplied for the current platform. On web, `/compat` forwards only `enableHighAccuracy`, `timeout`, and `maximumAge` to `navigator.geolocation`.
- `distanceFilter` (m) - The minimum distance from the previous location to exceed before returning a new location. Set to 0 to not filter locations. Defaults to 100m on Android and no distance filter on iOS.
- `useSignificantChanges` (bool) - Uses the battery-efficient native significant changes APIs to return locations. Locations will only be returned when the device detects a significant distance has been breached. Defaults to FALSE.
- `activityType` (iOS only) - Core Location activity type.
- `pausesLocationUpdatesAutomatically` (iOS only) - Core Location automatic pause behavior.
- `showsBackgroundLocationIndicator` (iOS only) - Shows the iOS background location indicator when the app has background location capability and permission.

`timeout`, `maximumAge`, and `fastestInterval` are part of the legacy option
type for compatibility, but native `/compat` watches do not use them. On web,
`watchPosition()` forwards `timeout`, `maximumAge`, and `enableHighAccuracy` to
`navigator.geolocation`.

### `clearWatch()`

Clears watch observer by id returned by `watchPosition()`

```ts
Geolocation.clearWatch(watchID: number);
```
