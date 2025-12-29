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


## 2. iOS Setup

### Permissions

Add the following keys to your **Info.plist**:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app requires access to your location while it's in use.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app requires access to your location at all times.</string>
```


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


## 4. Usage with Modern API (Recommended)

The Modern API provides **simple functional calls** with direct functions and a single hook for tracking.

### Setup Configuration

Configure once at app startup:

```tsx
import { useEffect } from 'react';
import { setConfiguration } from 'react-native-nitro-geolocation';

function App() {
  useEffect(() => {
    setConfiguration({
      authorizationLevel: 'whenInUse',
      enableBackgroundLocationUpdates: false,
      locationProvider: 'auto'
    });
  }, []);

  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
}
```

### Request Permission

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

### Get Current Position

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

### Watch Position (Real-time Tracking)

```tsx
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { useWatchPosition } from 'react-native-nitro-geolocation';

function LiveTracker() {
  const [enabled, setEnabled] = useState(false);

  const { position, error, isWatching } = useWatchPosition({
    enabled,
    enableHighAccuracy: true,
    distanceFilter: 10,  // Update every 10 meters
    interval: 5000       // Update every 5 seconds
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

**Key Features**:
- ✅ Automatic cleanup when component unmounts
- ✅ Declarative start/stop with `enabled` prop
- ✅ No need to manage watch IDs manually
- ✅ Battery efficient - native subscription stops when disabled


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

Upgrade to the simpler functional API:

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
    enableHighAccuracy: true
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


## 7. Development Tools (Optional) - **COMMING SOON**

For an enhanced development experience, install the Rozenite DevTools plugin to mock locations:

```bash
npm install @rozenite/react-native-nitro-geolocation-plugin
# or
yarn add @rozenite/react-native-nitro-geolocation-plugin
```

Add to your app:

```tsx
import { useGeolocationDevTools } from '@rozenite/react-native-nitro-geolocation-plugin';
import { createPosition } from '@rozenite/react-native-nitro-geolocation-plugin/presets';

function App() {
  // Enable location mocking in development
  useGeolocationDevTools({
    initialPosition: createPosition('Seoul, South Korea')
  });

  // ... rest of your app
}
```

**Features**:
- 🗺️ Interactive map interface
- 📍 Click to set location
- ⌨️ Arrow key navigation
- 🏙️ 20 city presets
- 📊 Real-time heading/speed calculation

Learn more in the [DevTools Plugin Guide](/guide/devtools).

:::warning Prerequisites
The DevTools plugin requires [Rozenite DevTools](https://github.com/rozenite/rozenite) to be installed in your project.
:::


## Next Steps

- [DevTools Plugin Guide](/guide/devtools) — Mock locations in development
- [Modern API Reference](/guide/modern-api) — Complete documentation
- [Legacy API Reference](/guide/legacy-api) — Compatibility methods
- [Why Nitro Module?](/guide/why-nitro-module) — Architecture deep dive
- [Benchmark Results](/guide/benchmark) — Performance comparison
