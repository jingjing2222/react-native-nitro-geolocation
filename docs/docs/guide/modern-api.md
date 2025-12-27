---
title: Modern API (Recommended)
---

> React-friendly hooks with role-based design patterns

The Modern API provides a React-first approach to geolocation with Hooks and Provider patterns.

## Design Philosophy

**Role-Based Hook Design**:

Each hook follows the pattern that best fits its responsibility:

- **Query style** (`useGetCurrentPosition`): Promise-based one-time requests with automatic state management
- **Mutation style** (`useRequestPermission`): Explicit user actions with pending/error states
- **Stream style** (`useWatchPosition`): Continuous data subscriptions with declarative on/off

**Core Principles**:

- **Provider-based configuration**: Set up once, use anywhere
- **Declarative hooks**: `useWatchPosition({ enabled })` instead of imperative start/stop
- **Automatic cleanup**: No need to manually unsubscribe
- **Type-safe**: Full TypeScript support with inference
- **Battery efficient**: Native subscriptions stop immediately when disabled

## GeolocationClientProvider

The Provider component makes the client available to all child components via React Context.

### Setup

```tsx
import {
  GeolocationClient,
  GeolocationClientProvider,
} from 'react-native-nitro-geolocation';

const geolocationClient = new GeolocationClient({
  authorizationLevel: 'whenInUse',
  locationProvider: 'auto',
});

function App() {
  return (
    <GeolocationClientProvider client={geolocationClient}>
      <YourApp />
    </GeolocationClientProvider>
  );
}
```

### Why Use Provider?

- **Single configuration**: Set up once at app root
- **No prop drilling**: Access client from any component
- **React-friendly**: Works seamlessly with hooks
- **Type-safe context**: TypeScript knows the client type

## Hooks

All hooks require `GeolocationClientProvider` in the component tree.

### useCheckPermission()

Check current location permission status without requesting it.

```tsx
import { useCheckPermission } from 'react-native-nitro-geolocation';

function PermissionStatus() {
  const { checkPermission } = useCheckPermission();
  const [status, setStatus] = useState<PermissionStatus | null>(null);

  useEffect(() => {
    checkPermission().then(setStatus);
  }, []);

  return <Text>Permission: {status}</Text>;
}
```

**Returns**:

- `checkPermission`: `() => Promise<PermissionStatus>`

**Permission Status**:

- `'granted'` - User granted location permission
- `'denied'` - User denied permission
- `'restricted'` - Permission restricted (iOS parental controls)
- `'undetermined'` - Permission not yet requested

---

### useRequestPermission()

Request location permission from the user in **Mutation style**.

```tsx
import { useRequestPermission } from 'react-native-nitro-geolocation';

function PermissionButton() {
  const {
    requestPermission,
    status,
    isPending,
    isError,
    error
  } = useRequestPermission();

  const handlePress = async () => {
    try {
      const result = await requestPermission();
      if (result === 'granted') {
        console.log('Permission granted!');
      }
    } catch (err) {
      console.error('Permission error:', err);
    }
  };

  return (
    <View>
      <Button
        onPress={handlePress}
        disabled={isPending}
        title={isPending ? 'Requesting...' : 'Enable Location'}
      />
      {isError && <Text>Error: {error?.message}</Text>}
      {status && <Text>Status: {status}</Text>}
    </View>
  );
}
```

**Returns**:

- `requestPermission`: `() => Promise<PermissionStatus>` - Trigger permission request
- `status`: `PermissionStatus | null` - Latest permission status after request
- `isPending`: `boolean` - Whether request is in progress
- `isError`: `boolean` - Whether an error occurred
- `error`: `LocationError | null` - Error details if failed

**Behavior**:

- Shows system permission dialog if `undetermined`
- Returns immediately if already `granted` or `denied`
- On iOS, uses `authorizationLevel` from client config
- State is automatically managed (loading, error, status)

---

### useGetCurrentPosition()

Get current location (one-time request) in **Query style** with automatic state management.

```tsx
import { useGetCurrentPosition } from 'react-native-nitro-geolocation';

// Auto-fetch on mount
function LocationDisplay() {
  const {
    position,
    isLoading,
    isError,
    error,
    refetch
  } = useGetCurrentPosition({
    enabled: true,  // Auto-fetch (default)
    enableHighAccuracy: true,
    timeout: 15000,
  });

  if (isLoading) return <Text>Loading location...</Text>;
  if (isError) return <Text>Error: {error?.message}</Text>;
  if (!position) return null;

  return (
    <View>
      <Text>Lat: {position.coords.latitude}</Text>
      <Text>Lng: {position.coords.longitude}</Text>
      <Button title="Refresh" onPress={() => refetch()} />
    </View>
  );
}

// Manual trigger only
function LocationButton() {
  const {
    position,
    isLoading,
    isError,
    error,
    refetch
  } = useGetCurrentPosition({
    enabled: false  // Manual only
  });

  return (
    <View>
      <Button
        onPress={() => refetch()}
        disabled={isLoading}
        title={isLoading ? 'Loading...' : 'Get Location'}
      />
      {isError && <Text>Error: {error?.message}</Text>}
      {position && (
        <Text>
          {position.coords.latitude}, {position.coords.longitude}
        </Text>
      )}
    </View>
  );
}
```

**Returns**:

- `position`: `GeolocationResponse | null` - Current location data
- `isLoading`: `boolean` - Whether request is in progress
- `isError`: `boolean` - Whether an error occurred
- `error`: `LocationError | null` - Error details if failed
- `refetch`: `() => Promise<void>` - Manually trigger location request

**Options**:

- `enabled?: boolean` - Auto-fetch on mount (default: `true`)
- `timeout?: number` - Request timeout in ms (default: 600000 / 10 min)
- `maximumAge?: number` - Max age of cached location in ms (default: 0)
- `enableHighAccuracy?: boolean` - Use GPS vs network location

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

---

### useWatchPosition({ enabled })

Watch for continuous location updates with automatic lifecycle management in **Stream style**.

```tsx
import { useWatchPosition } from 'react-native-nitro-geolocation';

function LiveTracker() {
  const [enabled, setEnabled] = useState(true);

  const {
    position,
    error,
    isWatching
  } = useWatchPosition({
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

      {isWatching ? (
        <Text>Watching 🟢</Text>
      ) : (
        <Text>Stopped 🔴</Text>
      )}

      {error && (
        <Text style={{ color: 'red' }}>Error: {error.message}</Text>
      )}

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

- `position`: `GeolocationResponse | null` - Latest position (null if no update yet)
- `error`: `LocationError | null` - Error details if location watching failed
- `isWatching`: `boolean` - Whether currently watching

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

## Advanced Patterns

### Custom Hook Combining Multiple APIs

```tsx
function useLocationWithPermission() {
  const {
    requestPermission,
    status: permissionStatus,
    isPending: isRequestingPermission
  } = useRequestPermission();

  const {
    position,
    isLoading,
    refetch
  } = useGetCurrentPosition({
    enabled: false  // Manual trigger
  });

  const getLocation = async () => {
    // Request permission if needed
    if (permissionStatus !== 'granted') {
      const newStatus = await requestPermission();
      if (newStatus !== 'granted') {
        throw new Error('Permission denied');
      }
    }

    // Get location
    await refetch();
  };

  return {
    getLocation,
    position,
    isLoading: isLoading || isRequestingPermission,
    permissionStatus
  };
}
```

### Error Boundary for Location Errors

```tsx
import { ErrorBoundary } from 'react-error-boundary';

function LocationErrorFallback({ error }) {
  return (
    <View>
      <Text>Location Error: {error.message}</Text>
      <Button title="Retry" onPress={() => window.location.reload()} />
    </View>
  );
}

function App() {
  return (
    <ErrorBoundary FallbackComponent={LocationErrorFallback}>
      <LocationTracker />
    </ErrorBoundary>
  );
}
```

### Conditional Tracking Based on App State

```tsx
import { useAppState } from '@react-native-community/hooks';

function BackgroundTracker() {
  const appState = useAppState();
  const isActive = appState === 'active';

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

## GeolocationClient

The `GeolocationClient` class manages geolocation configuration and provides direct access to location APIs.

### Configuration

```tsx
import { GeolocationClient } from 'react-native-nitro-geolocation';

const client = new GeolocationClient({
  // iOS: Authorization level
  authorizationLevel: 'whenInUse' | 'always' | 'auto',

  // iOS: Enable background location
  enableBackgroundLocationUpdates: boolean,

  // Android: Location provider
  locationProvider: 'playServices' | 'android' | 'auto',
});
```

### Standalone Usage (Without Provider)

You can use `GeolocationClient` directly without a Provider:

```tsx
const client = new GeolocationClient({
  authorizationLevel: 'whenInUse', // Example config
  locationProvider: 'auto', // Example config
});

// Check permission
const status = await client.checkPermission();

// Request permission
const newStatus = await client.requestPermission();

// Get current position
const position = await client.getCurrentPosition({
  enableHighAccuracy: true,
});

// Watch position
const token = client.watchPosition(
  (position) => console.log(position),
  (error) => console.error(error),
  { distanceFilter: 10 }
);

// Cleanup
client.unwatch(token);
```

**When to use standalone**:

- One-off location requests outside React components
- Utility functions or services
- Testing and debugging

## TypeScript Support

All Modern API exports are fully typed:

```typescript
import type {
  GeolocationClient,
  GeolocationClientConfig,
  PermissionStatus,
  LocationRequestOptions,
  LocationError,
  GeolocationResponse,
  GeolocationCoordinates,
} from 'react-native-nitro-geolocation';
```

### Type Inference

Hooks provide full type inference:

```tsx
const { position } = useWatchPosition({ enabled: true });
// position: GeolocationResponse | null (inferred)

const { position, refetch } = useGetCurrentPosition({ enabled: false });
// position: GeolocationResponse | null (inferred)
// refetch: () => Promise<void> (inferred)

const { requestPermission, status } = useRequestPermission();
// requestPermission: () => Promise<PermissionStatus> (inferred)
// status: PermissionStatus | null (inferred)
```

## Comparison with Legacy API

| Feature          | Modern API                               | Legacy API                               |
| ---------------- | ---------------------------------------- | ---------------------------------------- |
| **Import**       | `react-native-nitro-geolocation`         | `react-native-nitro-geolocation/compat`  |
| **Pattern**      | Hooks + Provider                         | Callbacks                                |
| **Cleanup**      | Automatic                                | Manual (`clearWatch`)                    |
| **Enable/Disable** | `{ enabled }` prop                       | `watchPosition` / `clearWatch`           |
| **Watch ID**     | Hidden (internal)                        | User-managed                             |
| **TypeScript**   | Full inference                           | Basic types                              |
| **React Friendly** | ✅ Yes                                   | ⚠️ Requires useEffect boilerplate       |

---

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
