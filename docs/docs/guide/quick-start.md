# Quick Start

This guide walks you through installing and setting up **React Native Nitro Geolocation** in your React Native project.

## 1. Installation

Before installing the module, make sure you have a React Native environment (0.75+).

```bash
# Install Nitro core and Geolocation module
yarn add react-native-nitro-modules@">=0.32.0" react-native-nitro-geolocation

# or using npm
npm install react-native-nitro-modules@">=0.32.0" react-native-nitro-geolocation
```

After installation, rebuild your native app to ensure the new module is linked.

```bash
cd ios && pod install
```

---

## 2. iOS Setup

### Permissions

Add the following keys to your **Info.plist**:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app requires access to your location while it's in use.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app requires access to your location at all times.</string>
```

---

## 3. Android Setup

Add the following permissions to your **android/app/src/main/AndroidManifest.xml**:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

Optional (for background access):

```xml
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
```

---

## 4. Usage with Modern API (Recommended)

The Modern API provides a **TanStack Query-inspired** experience with Hooks and Provider pattern.

### Setup Provider

Wrap your app with `GeolocationClientProvider`:

```tsx
import {
  GeolocationClient,
  GeolocationClientProvider
} from 'react-native-nitro-geolocation';

// Create client instance
const geolocationClient = new GeolocationClient({
  authorizationLevel: 'whenInUse',
  enableBackgroundLocationUpdates: false,
  locationProvider: 'auto'
});

function App() {
  return (
    <GeolocationClientProvider client={geolocationClient}>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </GeolocationClientProvider>
  );
}
```

### Request Permission

```tsx
import { useRequestPermission } from 'react-native-nitro-geolocation';

function PermissionButton() {
  const { requestPermission } = useRequestPermission();

  const handlePress = async () => {
    const status = await requestPermission();
    if (status === 'granted') {
      console.log('Permission granted!');
    }
  };

  return <Button onPress={handlePress} title="Enable Location" />;
}
```

### Get Current Position

```tsx
import { useGetCurrentPosition } from 'react-native-nitro-geolocation';

function LocationButton() {
  const { getCurrentPosition } = useGetCurrentPosition();
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    setLoading(true);
    try {
      const pos = await getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000
      });
      console.log('Lat:', pos.coords.latitude);
      console.log('Lng:', pos.coords.longitude);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return <Button onPress={handlePress} disabled={loading} />;
}
```

### Watch Position (Real-time Tracking)

```tsx
import { useWatchPosition } from 'react-native-nitro-geolocation';

function LiveTracker() {
  const [enabled, setEnabled] = useState(true);

  const { data, isWatching } = useWatchPosition({
    enabled,
    enableHighAccuracy: true,
    distanceFilter: 10  // Update every 10 meters
  });

  return (
    <View>
      <Switch
        value={enabled}
        onValueChange={setEnabled}
        label="Track location"
      />

      {isWatching ? (
        <Text>Watching...</Text>
      ) : (
        <Text>Stopped</Text>
      )}

      {data && (
        <View>
          <Text>Lat: {data.coords.latitude}</Text>
          <Text>Lng: {data.coords.longitude}</Text>
          <Text>Accuracy: {data.coords.accuracy}m</Text>
        </View>
      )}
    </View>
  );
}
```

**Key Features**:
- ✅ Automatic cleanup when component unmounts
- ✅ Declarative start/stop with `enabled` prop
- ✅ No need to manage watch IDs manually

---

## 5. Usage with Legacy API (Compatibility)

For compatibility with `@react-native-community/geolocation`, use the `/compat` import:

```tsx
import Geolocation from 'react-native-nitro-geolocation/compat';

Geolocation.getCurrentPosition(
  (position) => {
    console.log('Latitude:', position.coords.latitude);
    console.log('Longitude:', position.coords.longitude);
  },
  (error) => console.error('Location error:', error),
  { enableHighAccuracy: true, timeout: 15000 }
);

// Subscribe to updates
const watchId = Geolocation.watchPosition(
  (position) => console.log('Updated position:', position),
  (error) => console.error(error)
);

// Don't forget to cleanup!
Geolocation.clearWatch(watchId);
```

---

## 6. Migration Guides

### From `@react-native-community/geolocation`

Simply change the import path:

```diff
- import Geolocation from '@react-native-community/geolocation';
+ import Geolocation from 'react-native-nitro-geolocation/compat';
```

or

```diff
- import { getCurrentPosition, watchPosition } from '@react-native-community/geolocation';
+ import { getCurrentPosition, watchPosition } from 'react-native-nitro-geolocation/compat';
```

**All methods work identically** — 100% API compatible! You'll get:
- Better performance via JSI
- Reduced bridge serialization overhead
- Improved permission consistency
- TypeScript definitions out of the box

### From Legacy to Modern API (Recommended)

Upgrade to hooks for better developer experience:

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
  const { data } = useWatchPosition({
    enabled: true,
    enableHighAccuracy: true
  });

  return <Map position={data} />;
}
```

**Benefits**:
- 70% less code
- No watch ID management
- Automatic cleanup
- Declarative enable/disable
- Better TypeScript support

---

## Next Steps

- [Modern API Reference](/guide/modern-api) — Complete hooks documentation
- [Legacy API Reference](/guide/legacy-api) — Compatibility methods
- [Why Nitro Module?](/guide/why-nitro-module) — Architecture deep dive
- [Benchmark Results](/guide/benchmark) — Performance comparison
