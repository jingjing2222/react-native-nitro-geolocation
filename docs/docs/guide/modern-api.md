---
title: Modern API (Recommended)
---

> Simple functional API with direct calls and minimal abstractions

The Modern API provides a straightforward approach to geolocation with direct function calls and a single hook for continuous tracking.

## Design Philosophy

**Simple and Direct**:

- **Direct function calls**: No complex abstractions or classes
- **Single hook**: Only `useWatchPosition` for continuous tracking
- **No Provider required**: Just call functions directly
- **Automatic cleanup**: Hook handles subscription lifecycle

**Core Principles**:

- **Simple configuration**: Call `setConfiguration()` once at app startup
- **Direct function calls**: Use `getCurrentPosition()`, `requestPermission()` etc.
- **One hook for tracking**: `useWatchPosition` for continuous updates
- **Type-safe**: Full TypeScript support
- **Battery efficient**: Native subscriptions stop immediately when disabled

## Configuration

Set global configuration once at app startup.

### setConfiguration()

```tsx
import { setConfiguration } from 'react-native-nitro-geolocation';

// In App.tsx or index.js
setConfiguration({
  authorizationLevel: 'whenInUse',
  enableBackgroundLocationUpdates: false,
  locationProvider: 'auto'
});
```

**Options**:

- `autoRequestPermission?: boolean` - Deprecated compatibility option. `setConfiguration()` does not request permission; call `requestPermission()` explicitly when the app is ready to show the native prompt.
- `authorizationLevel?: 'whenInUse' | 'always' | 'auto'` - iOS: Authorization level
- `enableBackgroundLocationUpdates?: boolean` - iOS: Enable background location
- `locationProvider?: 'playServices' | 'android' | 'auto'` - Android: Location provider. `auto` currently uses Android's platform `LocationManager`; set `playServices` explicitly to use Google Play Services fused location.

**Type**:

```typescript
export type GeolocationConfiguration = {
  /** @deprecated Call `requestPermission()` explicitly. */
  autoRequestPermission?: boolean;
  authorizationLevel?: 'always' | 'whenInUse' | 'auto';
  enableBackgroundLocationUpdates?: boolean;
  /** `auto` currently uses Android's platform LocationManager. */
  locationProvider?: 'playServices' | 'android' | 'auto';
};

/**
 * @deprecated Use `GeolocationConfiguration` instead.
 * This alias is kept only for backward compatibility.
 */
export type ModernGeolocationConfiguration = GeolocationConfiguration;
```

**When to call**:

- Once at app startup (e.g., in `App.tsx` or `index.js`)
- Before making any location requests


## Permission Functions

### checkPermission()

Check current location permission status without requesting it.

```tsx
import { checkPermission } from 'react-native-nitro-geolocation';

async function checkLocationPermission() {
  const status = await checkPermission();
  console.log('Permission status:', status);
  // status: 'granted' | 'denied' | 'restricted' | 'undetermined'
}
```

**Returns**: `Promise<PermissionStatus>`

**Permission Status**:

- `'granted'` - User granted location permission
- `'denied'` - User denied permission
- `'restricted'` - Permission restricted (iOS parental controls)
- `'undetermined'` - Permission not yet requested


### requestPermission()

Request location permission from the user.

```tsx
import { useState } from 'react';
import { Button, Text, View } from 'react-native';
import { requestPermission } from 'react-native-nitro-geolocation';

function PermissionButton() {
  const [status, setStatus] = useState<string>('unknown');
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    setLoading(true);
    try {
      const result = await requestPermission();
      setStatus(result);
      if (result === 'granted') {
        console.log('Permission granted!');
      }
    } catch (err) {
      console.error('Permission error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <Button
        onPress={handlePress}
        disabled={loading}
        title={loading ? 'Requesting...' : 'Enable Location'}
      />
      <Text>Status: {status}</Text>
    </View>
  );
}
```

**Returns**: `Promise<PermissionStatus>`

**Behavior**:

- Shows system permission dialog if `undetermined`
- Returns immediately if already `granted` or `denied`
- On iOS, uses `authorizationLevel` from configuration


## Location Functions

### Android Provider and Settings

Available since `v1.2`.

Use these helpers before user-facing precise-location flows where the app needs
to know whether Android device settings can satisfy the request.

```tsx
import {
  getCurrentPosition,
  getLocationAvailability,
  getProviderStatus,
  hasServicesEnabled,
  requestLocationSettings
} from 'react-native-nitro-geolocation';

async function prepareAccurateLocation() {
  const availability = await getLocationAvailability();
  const servicesEnabled = await hasServicesEnabled();
  const providerStatus = await getProviderStatus();

  if (!availability.available || !servicesEnabled || providerStatus.googleLocationAccuracyEnabled === false) {
    await requestLocationSettings({
      accuracy: { android: 'high' },
      interval: 5000,
      fastestInterval: 1000
    });
  }

  return getCurrentPosition({
    accuracy: { android: 'high', ios: 'best' },
    timeout: 15000
  });
}
```

**Functions**:

- `hasServicesEnabled(): Promise<boolean>` - Checks whether device-level
  location services are enabled.
- `getProviderStatus(): Promise<LocationProviderStatus>` - Returns provider
  state such as `locationServicesEnabled`, `gpsAvailable`,
  `networkAvailable`, `passiveAvailable`, and Android Google Location Accuracy
  when Google Play Services exposes it.
- `getLocationAvailability(): Promise<{ available: boolean; reason?: string }>` -
  Available since `v1.2`. Android reads Fused Location availability when
  `locationProvider: 'playServices'` is configured and otherwise falls back to
  platform provider/service checks. iOS maps Core Location service and
  authorization state.
- `requestLocationSettings(options?): Promise<LocationProviderStatus>` -
  Checks the requested Android location settings and shows Android's native
  resolution dialog when available. It resolves with the updated provider
  status after the settings satisfy the request.

`requestLocationSettings()` is Android-focused. On iOS it resolves with the
current Core Location service status and does not show a settings dialog.

### getCurrentPosition()

Get current location (one-time request).

```tsx
import { useState } from 'react';
import { Button, Text, View } from 'react-native';
import {
  getCurrentPosition,
  type GeolocationResponse
} from 'react-native-nitro-geolocation';

function LocationButton() {
  const [position, setPosition] = useState<GeolocationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePress = async () => {
    setLoading(true);
    setError(null);
    try {
      const pos = await getCurrentPosition({
        accuracy: { android: 'high', ios: 'best' },
        timeout: 15000
      });
      setPosition(pos);
    } catch (err: any) {
      setError(err?.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <Button
        onPress={handlePress}
        disabled={loading}
        title={loading ? 'Loading...' : 'Get Location'}
      />
      {error && <Text style={{ color: 'red' }}>Error: {error}</Text>}
      {position && (
        <View>
          <Text>Lat: {position.coords.latitude}</Text>
          <Text>Lng: {position.coords.longitude}</Text>
          <Text>Accuracy: {position.coords.accuracy}m</Text>
        </View>
      )}
    </View>
  );
}
```

**Parameters**: `options?: LocationRequestOptions`

**Options**:

- `timeout?: number` - Request timeout in ms (default: 600000 / 10 min)
- `maximumAge?: number` - Max age of cached location in ms (default: 0)
- `enableHighAccuracy?: boolean` - Deprecated since `v1.2`. Kept for v1 compatibility only; prefer `accuracy`. It is expected to be removed from the Modern API in v2.
- `accuracy?: { android?: 'high' | 'balanced' | 'low' | 'passive'; ios?: 'bestForNavigation' | 'best' | 'nearestTenMeters' | 'hundredMeters' | 'kilometer' | 'threeKilometers' | 'reduced' }` - Platform-specific accuracy preset, available since `v1.2`. When a preset is provided for the current platform, it takes precedence over `enableHighAccuracy`.
- `granularity?: 'permission' | 'coarse' | 'fine'` - Android-only request granularity, available since `v1.2`. `permission` follows the granted permission level, `coarse` avoids fine GPS-only requests, and `fine` requires fine location permission.
- `waitForAccurateLocation?: boolean` - Android-only Fused request tuning, available since `v1.2`.
- `maxUpdateAge?: number` - Android-only maximum age for an initial update in ms, available since `v1.2`.
- `maxUpdateDelay?: number` - Android-only maximum batching delay in ms, available since `v1.2`.
- `maxUpdates?: number` - Android-only maximum watch updates before native cleanup, available since `v1.2`.
- `activityType?: 'other' | 'automotiveNavigation' | 'fitness' | 'otherNavigation' | 'airborne'` - iOS Core Location activity type, available since `v1.2`.
- `pausesLocationUpdatesAutomatically?: boolean` - iOS automatic pause behavior, available since `v1.2`.
- `showsBackgroundLocationIndicator?: boolean` - iOS background location indicator, available since `v1.2`. This only has a visible effect when the app has background location capability and permission.

Use `accuracy` when you need explicit platform-native behavior:

```tsx
await getCurrentPosition({
  accuracy: {
    android: 'high',
    ios: 'bestForNavigation'
  },
  granularity: 'permission',
  waitForAccurateLocation: true,
  timeout: 15000
});
```

Android maps the presets to native provider/priority intent: `high` prefers
GPS with a network fallback, `balanced` uses the network provider, `low` uses
network/passive providers, and `passive` only listens through the passive
provider. iOS maps the presets to Core Location `desiredAccuracy` constants.

iOS tuning options are applied to both one-time requests and watches through
the shared Core Location manager configuration:

```tsx
await getCurrentPosition({
  accuracy: { ios: 'kilometer' },
  activityType: 'fitness',
  pausesLocationUpdatesAutomatically: false,
  showsBackgroundLocationIndicator: false,
  timeout: 15000
});
```

Use `showsBackgroundLocationIndicator` only after configuring background
location in the app target, including the `location` background mode and the
required Info.plist location usage descriptions.

**Returns**: `Promise<GeolocationResponse>`

**Response**:

```typescript
export type LocationProviderUsed =
  | 'fused'
  | 'gps'
  | 'network'
  | 'passive'
  | 'unknown';

interface GeolocationResponse {
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
  mocked?: boolean;
  provider?: LocationProviderUsed;
}
```

`mocked` and `provider` are optional metadata fields added to the Modern API response in v1.2. The `/compat` API keeps the `@react-native-community/geolocation` response shape and does not include these fields.

**Error Handling**:

```tsx
import {
  LocationErrorCode,
  watchPosition,
  unwatch,
} from 'react-native-nitro-geolocation';

const token = watchPosition(
  (position) => {
    console.log(position.coords.latitude, position.coords.longitude);
  },
  (error) => {
    if (error.code === LocationErrorCode.SETTINGS_NOT_SATISFIED) {
      // Device/provider settings do not satisfy the request.
    }
    // error.message: Human-readable error
  }
);

unwatch(token);
```

Modern API errors use the following codes. The expanded modern-only native
setup/provider codes (`INTERNAL_ERROR`, `PLAY_SERVICE_NOT_AVAILABLE`, and
`SETTINGS_NOT_SATISFIED`) were added in v1.2; codes 1-3 remain aligned with the
legacy browser-style contract.

The code is committed by the native layer before a `LocationError` is sent to
JS. Both `watchPosition` error callbacks and public Promise rejections from
`getCurrentPosition`/`requestPermission` receive the same `{ code, message }`
shape; JS only relays that object and does not parse or reclassify native
messages.

| Code | Name                         | Meaning                                      |
| ---- | ---------------------------- | -------------------------------------------- |
| -1   | `INTERNAL_ERROR`             | Unexpected module/native failure             |
| 1    | `PERMISSION_DENIED`          | Location permission was denied               |
| 2    | `POSITION_UNAVAILABLE`       | A position fix is unavailable                |
| 3    | `TIMEOUT`                    | The request timed out                        |
| 4    | `PLAY_SERVICE_NOT_AVAILABLE` | Android Google Play Services is unavailable  |
| 5    | `SETTINGS_NOT_SATISFIED`     | Device/provider settings do not satisfy the request |

The `/compat` API keeps the legacy browser-style error contract with only `PERMISSION_DENIED`, `POSITION_UNAVAILABLE`, and `TIMEOUT`.

### getLastKnownPosition()

Available since `v1.2`.

Read the best cached native location explicitly without starting a fresh
location request. This is useful for fast app startup, stale-while-refresh UI,
and cache-only flows where a fresh GPS/network request would be too expensive.

```tsx
import { getLastKnownPosition } from 'react-native-nitro-geolocation';

const cached = await getLastKnownPosition({
  maximumAge: 60_000,
  accuracy: { android: 'balanced', ios: 'hundredMeters' }
});
```

`getLastKnownPosition(options?)` uses the same provider and cache-filtering
options as `getCurrentPosition()`, but it never falls through to a fresh native
request. If no cached location satisfies `maximumAge` or permission is denied,
it rejects with the native `LocationError` contract, usually
`POSITION_UNAVAILABLE` or `PERMISSION_DENIED`.

### Geocoding APIs

Available since `v1.2`.

Use `geocode()` to convert a human-readable address into candidate coordinates,
and `reverseGeocode()` to convert coordinates into candidate address fields.
Both APIs use the platform geocoder, so result quality, language, network
behavior, and availability can differ between Android `Geocoder` and iOS
`CLGeocoder`.

```tsx
import {
  geocode,
  reverseGeocode
} from 'react-native-nitro-geolocation';

const locations = await geocode('City Hall, Seoul, South Korea');
// locations: Array<{ latitude: number; longitude: number; accuracy?: number }>

const addresses = await reverseGeocode({
  latitude: 37.5665,
  longitude: 126.978
});
// addresses: Array<{
//   country?: string;
//   region?: string;
//   city?: string;
//   district?: string;
//   street?: string;
//   postalCode?: string;
//   formattedAddress?: string;
// }>
```

`geocode(address)` rejects with `INTERNAL_ERROR` when `address` is blank.
`reverseGeocode(coords)` rejects with `INTERNAL_ERROR` when latitude or
longitude is non-finite or outside the valid coordinate range. Platform
geocoder service failures reject with the same `{ code, message }`
`LocationError` shape as the rest of the Modern API.

### Heading APIs

Available since `v1.2`.

Use `getHeading()` for a single compass heading and `watchHeading()` for
continuous heading updates. Stop heading watches with the same `unwatch(token)`
API used by `watchPosition()`.

```tsx
import { getHeading, watchHeading, unwatch } from 'react-native-nitro-geolocation';

const heading = await getHeading();

const token = watchHeading(
  (nextHeading) => {
    console.log(nextHeading.magneticHeading);
  },
  (error) => {
    console.error(error.message);
  },
  { headingFilter: 5 }
);

unwatch(token);
```

```typescript
type Heading = {
  magneticHeading: number;
  trueHeading?: number;
  accuracy?: number;
  timestamp: number;
};
```

Heading APIs require location permission and reject with the same
`LocationError` contract when permission is denied or heading sensors are not
available.

### iOS Accuracy Authorization

Available since `v1.2`.

Use `getAccuracyAuthorization()` to read whether iOS currently grants full or
reduced location accuracy. Android maps fine permission to `full`, coarse-only
permission to `reduced`, and no location permission to `unknown`.

```tsx
import {
  getAccuracyAuthorization,
  requestTemporaryFullAccuracy
} from 'react-native-nitro-geolocation';

const authorization = await getAccuracyAuthorization();

if (authorization === 'reduced') {
  await requestTemporaryFullAccuracy('TurnByTurnNavigation');
}
```

For iOS, `requestTemporaryFullAccuracy(purposeKey)` calls Core Location's
temporary full accuracy API. The `purposeKey` must exist in
`NSLocationTemporaryUsageDescriptionDictionary` in Info.plist, for example:

```xml
<key>NSLocationTemporaryUsageDescriptionDictionary</key>
<dict>
  <key>TurnByTurnNavigation</key>
  <string>Precise location improves turn-by-turn navigation.</string>
</dict>
```

Passing an empty `purposeKey` rejects with `INTERNAL_ERROR`. Android does not
show a temporary accuracy prompt and resolves with the current mapped accuracy
authorization.


## React Hook

### useWatchPosition()

Watch for continuous location updates with automatic lifecycle management.

```tsx
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { useWatchPosition } from 'react-native-nitro-geolocation';

function LiveTracker() {
  const [enabled, setEnabled] = useState(false);

  const { position, error, isWatching } = useWatchPosition({
    enabled,
    accuracy: { android: 'high', ios: 'best' },
    distanceFilter: 10, // Update every 10 meters
    interval: 5000, // Update every 5 seconds (Android)
  });

  return (
    <View>
      <Switch
        value={enabled}
        onValueChange={setEnabled}
        label="Track location"
      />

      <Text>Status: {isWatching ? 'Watching 🟢' : 'Stopped 🔴'}</Text>

      {error && (
        <Text style={{ color: 'red' }}>Error: {error.message}</Text>
      )}

      {position && (
        <View>
          <Text>Lat: {position.coords.latitude}</Text>
          <Text>Lng: {position.coords.longitude}</Text>
          <Text>Accuracy: {position.coords.accuracy}m</Text>
          {position.coords.speed !== null && (
            <Text>Speed: {position.coords.speed}m/s</Text>
          )}
        </View>
      )}
    </View>
  );
}
```

**Options**:

- `enabled?: boolean` - Start/stop watching (default: `false`)
- `enableHighAccuracy?: boolean` - Deprecated since `v1.2`. Kept for v1 compatibility only; prefer `accuracy`. It is expected to be removed from the Modern API in v2.
- `accuracy?: { android?: 'high' | 'balanced' | 'low' | 'passive'; ios?: 'bestForNavigation' | 'best' | 'nearestTenMeters' | 'hundredMeters' | 'kilometer' | 'threeKilometers' | 'reduced' }` - Platform-specific accuracy preset, available since `v1.2`.
- `granularity?: 'permission' | 'coarse' | 'fine'` - Android-only request granularity, available since `v1.2`
- `waitForAccurateLocation?: boolean` - Android-only high-accuracy initial update tuning, available since `v1.2`
- `maxUpdateAge?: number` - Android-only maximum age for an initial update, available since `v1.2`
- `maxUpdateDelay?: number` - Android-only batching delay, available since `v1.2`
- `maxUpdates?: number` - Android-only watch update limit, available since `v1.2`
- `distanceFilter?: number` - Minimum distance change in meters
- `interval?: number` - Update interval in ms (Android)
- `fastestInterval?: number` - Fastest interval in ms (Android)
- `timeout?: number` - Request timeout
- `maximumAge?: number` - Max cached location age
- `useSignificantChanges?: boolean` - Use significant changes mode (iOS)
- `activityType?: 'other' | 'automotiveNavigation' | 'fitness' | 'otherNavigation' | 'airborne'` - iOS Core Location activity type, available since `v1.2`
- `pausesLocationUpdatesAutomatically?: boolean` - iOS automatic pause behavior, available since `v1.2`
- `showsBackgroundLocationIndicator?: boolean` - iOS background location indicator, available since `v1.2`

**Returns**:

- `position: GeolocationResponse | null` - Latest position (null if no update yet)
- `error: LocationError | null` - Error details if location watching failed
- `isWatching: boolean` - Whether currently watching

**Key Features**:

- ✅ **Auto cleanup**: Unsubscribes when component unmounts or `enabled` becomes `false`
- ✅ **Declarative**: Toggle with `enabled` prop
- ✅ **No watch ID management**: Handled internally
- ✅ **Battery efficient**: Native subscription stops immediately when disabled
- ✅ **Reactive**: Changes to options restart the watch

**Common Patterns**:

1.  **Toggle tracking**:
    ```tsx
    const [tracking, setTracking] = useState(false);
    const { position } = useWatchPosition({ enabled: tracking });
    ```
2.  **Conditional tracking** (track only when screen is focused):
    ```tsx
    const isFocused = useIsFocused(); // React Navigation
    const { position } = useWatchPosition({ enabled: isFocused });
    ```
3.  **Track only when permission granted**:
    ```tsx
    const [hasPermission, setHasPermission] = useState(false);
    const { position, error } = useWatchPosition({
      enabled: hasPermission,
      accuracy: { android: 'high', ios: 'best' },
    });
    ```


## Low-level Functions (Advanced)

For non-React code or advanced use cases, you can use the low-level watch API.

### watchPosition()

```tsx
import { watchPosition, unwatch } from 'react-native-nitro-geolocation';

const token = watchPosition(
  (position) => {
    console.log('Position updated:', position.coords);
  },
  (error) => {
    console.error('Location error:', error.message);
  },
  {
    accuracy: { android: 'high', ios: 'best' },
    distanceFilter: 10
  }
);

// Later: cleanup
unwatch(token);
```

**Parameters**:
- `onUpdate: (position: GeolocationResponse) => void` - Success callback
- `onError?: (error: LocationError) => void` - Error callback
- `options?: LocationRequestOptions` - Location options

**Returns**: `string` - Subscription token

### unwatch()

Stop a specific watch subscription.

```tsx
import { unwatch } from 'react-native-nitro-geolocation';

unwatch(token);
```

### stopObserving()

Stop ALL watch subscriptions immediately.

```tsx
import { stopObserving } from 'react-native-nitro-geolocation';

// Emergency cleanup - stops all location tracking
stopObserving();
```


## Advanced Patterns

### Permission Check Before Location Request

```tsx
import {
  checkPermission,
  requestPermission,
  getCurrentPosition
} from 'react-native-nitro-geolocation';

async function getLocationWithPermission() {
  // Check permission first
  let status = await checkPermission();

  // Request if needed
  if (status !== 'granted') {
    status = await requestPermission();
  }

  // Get location if granted
  if (status === 'granted') {
    const position = await getCurrentPosition({
      accuracy: { android: 'high', ios: 'best' }
    });
    return position;
  } else {
    throw new Error('Permission denied');
  }
}
```

### Conditional Tracking Based on App State

```tsx
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useWatchPosition } from 'react-native-nitro-geolocation';

function BackgroundTracker() {
  const [isActive, setIsActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setIsActive(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  const { position, error } = useWatchPosition({
    enabled: isActive,
    distanceFilter: 50,
  });

  return (
    <>
      {error && <ErrorBanner message={error.message} />}
      <Map position={position?.coords} />
    </>
  );
}
```


## TypeScript Support

All Modern API exports are fully typed:

```typescript
import type {
  PermissionStatus,
  LocationRequestOptions,
  LocationErrorCode,
  LocationError,
  GeolocationResponse,
  GeolocationCoordinates,
  LocationProviderUsed,
  GeolocationConfiguration
} from 'react-native-nitro-geolocation';
```

`ModernGeolocationConfiguration` is still exported as a deprecated compatibility alias.

### Type Inference

Functions and hooks provide full type inference:

```tsx
const { position } = useWatchPosition({ enabled: true });
// position: GeolocationResponse | null (inferred)

const pos = await getCurrentPosition();
// pos: GeolocationResponse (inferred)

const status = await requestPermission();
// status: PermissionStatus (inferred)
```


## Comparison with Compat API

| Feature          | Modern API                               | Compat API                               |
| ---------------- | ---------------------------------------- | ---------------------------------------- |
| **Import**       | `react-native-nitro-geolocation`         | `react-native-nitro-geolocation/compat`  |
| **Pattern**      | Functions + Hook                         | Callbacks                                |
| **Configuration**| `setConfiguration()`                     | `setRNConfiguration()`                   |
| **Permission**   | `requestPermission()`                    | `requestAuthorization()`                 |
| **Get Location** | `getCurrentPosition()` (Promise)         | `getCurrentPosition()` (callbacks)       |
| **Watch**        | `useWatchPosition({ enabled })`          | `watchPosition()` / `clearWatch()`       |
| **Cleanup**      | Automatic (hook)                         | Manual (`clearWatch`)                    |
| **Watch ID**     | Hidden (internal)                        | User-managed                             |
| **TypeScript**   | Full inference                           | Basic types                              |
| **React Friendly** | ✅ Yes                                  | ⚠️ Requires useEffect boilerplate       |


## Migration from Compat

**Before (Compat API)**:

```tsx
import Geolocation from 'react-native-nitro-geolocation/compat';

function LocationTracker() {
  const [position, setPosition] = useState(null);
  const watchIdRef = useRef(null);

  useEffect(() => {
    watchIdRef.current = Geolocation.watchPosition(
      (pos) => setPosition(pos),
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );

    return () => {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return <Map position={position} />;
}
```

**After (Modern API)**:

```tsx
import { useWatchPosition } from 'react-native-nitro-geolocation';

function LocationTracker() {
  const { position } = useWatchPosition({
    enabled: true,
    accuracy: { android: 'high', ios: 'best' },
  });

  return <Map position={position} />;
}
```

**Benefits**:

- 70% less code
- No watch ID management
- Automatic cleanup
- Declarative enable/disable
- Better TypeScript support
