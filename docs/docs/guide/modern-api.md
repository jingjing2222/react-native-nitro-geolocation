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

- `authorizationLevel?: 'whenInUse' | 'always' | 'auto'` - iOS: Authorization level
- `enableBackgroundLocationUpdates?: boolean` - iOS: Enable background location
- `locationProvider?: 'playServices' | 'android' | 'auto'` - Android: Location provider

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
        enableHighAccuracy: true,
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
- `enableHighAccuracy?: boolean` - Use GPS vs network location

**Returns**: `Promise<GeolocationResponse>`

**Response**:

```typescript
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
}
```

**Error Handling**:

```tsx
try {
  const position = await getCurrentPosition();
} catch (error) {
  // error.code: 1 (PERMISSION_DENIED), 2 (POSITION_UNAVAILABLE), 3 (TIMEOUT)
  // error.message: Human-readable error
}
```


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
    enableHighAccuracy: true,
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
- `enableHighAccuracy?: boolean` - Use GPS
- `distanceFilter?: number` - Minimum distance change in meters
- `interval?: number` - Update interval in ms (Android)
- `fastestInterval?: number` - Fastest interval in ms (Android)
- `timeout?: number` - Request timeout
- `maximumAge?: number` - Max cached location age
- `useSignificantChanges?: boolean` - Use significant changes mode (iOS)

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
      enableHighAccuracy: true,
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
    enableHighAccuracy: true,
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
      enableHighAccuracy: true
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
  LocationError,
  GeolocationResponse,
  GeolocationCoordinates,
  ModernGeolocationConfiguration
} from 'react-native-nitro-geolocation';
```

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


## Comparison with Legacy API

| Feature          | Modern API                               | Legacy API                               |
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


## Migration from Legacy

**Before (Legacy API)**:

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
    enableHighAccuracy: true,
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
