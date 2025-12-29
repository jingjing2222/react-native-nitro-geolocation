# react-native-nitro-geolocation

[![NPM](https://img.shields.io/npm/v/react-native-nitro-geolocation)](https://www.npmjs.com/package/react-native-nitro-geolocation)

**Simple and Modern Geolocation for React Native** — Powered by Nitro Modules with JSI

A complete reimplementation of [`@react-native-community/geolocation`](https://github.com/michalchudziak/react-native-geolocation) for the React Native New Architecture, featuring:

- 🎯 **Simple functional API** — Direct function calls, no complex abstractions
- ⚡ **JSI-powered performance** — Direct native calls without the Bridge
- 🔁 **100% API compatibility** via `/compat` for easy migration
- 🪝 **Single Hook** — `useWatchPosition` for continuous tracking
- 🧹 **Automatic cleanup** — No manual subscription management
- 📱 **Consistent behavior** across iOS and Android
- 🛠️ **DevTools Plugin** — Mock locations with interactive map (Rozenite)

![react-native-nitro-geolocation](https://raw.githubusercontent.com/jingjing2222/react-native-nitro-geolocation/main/demo.gif)

---

## 📘 Documentation

Full documentation available at:
👉 [https://react-native-nitro-geolocation.pages.dev](https://react-native-nitro-geolocation.pages.dev)

---

## 🧭 Introduction

React Native Nitro Geolocation provides **two APIs** to fit your needs:

### 1. Modern API (Recommended)

**Simple functional API** with direct calls and a single hook for tracking:

```tsx
import {
  setConfiguration,
  requestPermission,
  getCurrentPosition,
  useWatchPosition
} from 'react-native-nitro-geolocation';

// Configure once at app startup
setConfiguration({
  authorizationLevel: 'whenInUse',
  locationProvider: 'auto'
});

// Request permission
const status = await requestPermission();

// Get current location
const position = await getCurrentPosition({
  enableHighAccuracy: true
});

// Continuous tracking with hook
function LocationTracker() {
  const { position, error, isWatching } = useWatchPosition({
    enabled: true,
    enableHighAccuracy: true,
    distanceFilter: 10
  });

  if (error) return <Text>Error: {error.message}</Text>;
  if (!position) return <Text>Waiting...</Text>;

  return (
    <Text>
      {position.coords.latitude}, {position.coords.longitude}
    </Text>
  );
}
```

**Benefits**:
- ✅ No complex abstractions — just functions and one hook
- ✅ Automatic cleanup when component unmounts
- ✅ Direct function calls for one-time operations
- ✅ Full TypeScript support

### 2. Legacy API (Compatibility)

**Drop-in replacement** for `@react-native-community/geolocation`:

```tsx
import Geolocation from 'react-native-nitro-geolocation/compat';

Geolocation.getCurrentPosition(
  (position) => console.log(position),
  (error) => console.error(error),
  { enableHighAccuracy: true }
);

const watchId = Geolocation.watchPosition(
  (position) => console.log(position)
);
Geolocation.clearWatch(watchId);
```

---

## 🏗 Architecture

### Modern API Architecture

```
React Components
  ↓ Direct function calls
  ↓ getCurrentPosition() / requestPermission()
  ↓ useWatchPosition({ enabled: true })
Nitro Module (JSI)
  ↓ Direct callbacks, no Bridge
Native (iOS/Android)
  ↓ CLLocationManager / FusedLocationProvider
Device GPS
```

### Legacy vs Modern Comparison

#### Legacy (Event-based, `@react-native-community/geolocation`)

```
JavaScript
  ↓ EventEmitter.addListener('geolocationDidChange', callback)
React Native Bridge (JSON serialization)
  ↓
Native Layer
  ↓ emit('geolocationDidChange', data)
  ↓
EventEmitter → User callback
```

#### Modern (Direct Callback via Nitro)

```
JavaScript
  ↓ getCurrentPosition() / useWatchPosition()
JSI Layer (No Bridge!)
  ↓
Native Layer
  ↓ callback(position) → JSI direct call
  ↓
User callback executed immediately
```

**Key advantages**:
- Callbacks passed directly to native via JSI
- No Bridge serialization overhead
- Simple API with minimal abstractions
- Independent callbacks per watcher

---

## ⚡ Quick Start

### 1. Installation

```bash
# Install Nitro core and Geolocation module
yarn add react-native-nitro-modules@">=0.32.0" react-native-nitro-geolocation

# or using npm
npm install react-native-nitro-modules@">=0.32.0" react-native-nitro-geolocation
```

Rebuild your native app:

```bash
cd ios && pod install
```

---

### 2. iOS Setup

Add permissions to your **Info.plist**:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app requires access to your location while it's in use.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app requires access to your location at all times.</string>
```

---

### 3. Android Setup

Add permissions to **AndroidManifest.xml**:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

Optional (for background):

```xml
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
```

---

### 4. Development Tools (Optional)

#### DevTools Plugin (Rozenite)

> **Prerequisites**: Requires [Rozenite DevTools](https://github.com/rozenite/rozenite) to be installed.

Mock geolocation data during development with an interactive map interface:

![DevTools Plugin](https://raw.githubusercontent.com/jingjing2222/react-native-nitro-geolocation/main/devtools.gif)

```bash
npm install @rozenite/react-native-nitro-geolocation-plugin
# or
yarn add @rozenite/react-native-nitro-geolocation-plugin
```

**Setup**:

```tsx
import { useGeolocationDevTools } from '@rozenite/react-native-nitro-geolocation-plugin';
import { createPosition } from '@rozenite/react-native-nitro-geolocation-plugin/presets';

function App() {
  // Enable location mocking in development
  useGeolocationDevTools({
    initialPosition: createPosition('Seoul, South Korea')
  });

  return <YourApp />;
}
```

**Features**:
- 🗺️ Interactive Leaflet map interface
- 📍 Click to set location instantly
- ⌨️ Arrow key navigation for precise control
- 🏙️ 20 pre-configured city presets
- ✏️ Manual latitude/longitude input
- 📊 Real-time heading, speed, and accuracy calculation
- 🌓 Dark mode support

[See full DevTools guide →](https://react-native-nitro-geolocation.pages.dev/guide/devtools)

---

### 5. Usage Examples

#### Modern API (Recommended)

**Setup Configuration (App.tsx)**:

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

  return <YourApp />;
}
```

**Request Permission**:

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

**Get Current Position**:

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

**Watch Position (Real-time Tracking)**:

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
      <Switch value={enabled} onValueChange={setEnabled} />
      <Text>Status: {isWatching ? 'Watching' : 'Not watching'}</Text>
      {error && <Text style={{ color: 'red' }}>Error: {error.message}</Text>}
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

**Low-level Watch API (Advanced)**:

For non-React code or advanced use cases:

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

#### Legacy API (Compatibility)

For existing apps migrating from `@react-native-community/geolocation`:

```tsx
import Geolocation from 'react-native-nitro-geolocation/compat';

Geolocation.getCurrentPosition(
  (position) => {
    console.log('Latitude:', position.coords.latitude);
    console.log('Longitude:', position.coords.longitude);
  },
  (error) => {
    console.error('Location error:', error);
  },
  { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
);

// Subscribe to continuous updates
const watchId = Geolocation.watchPosition(
  (position) => {
    console.log('Updated position:', position);
  },
  (error) => console.error(error),
);

// Don't forget cleanup!
Geolocation.clearWatch(watchId);
```

---

## 🔄 Migration Guide

### From `@react-native-community/geolocation`

Simply change the import path to use the `/compat` subpath:

```diff
- import Geolocation from '@react-native-community/geolocation';
+ import Geolocation from 'react-native-nitro-geolocation/compat';
```

**All methods work identically** — 100% API compatible!

### To Modern API (Recommended)

Upgrade to the simpler functional API:

**Before (Legacy)**:

```tsx
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
```

**After (Modern)**:

```tsx
const { position } = useWatchPosition({
  enabled: true,
  enableHighAccuracy: true
});
// Auto cleanup, no watch ID management needed!
```

**70% less code** with automatic cleanup and simpler API.

---

## 🧠 API Reference

### Modern API

#### Configuration

- **`setConfiguration(config)`** — Set global configuration (call once at app startup)

#### Permission

- **`checkPermission()`** — Check current permission status (returns Promise)
- **`requestPermission()`** — Request location permission (returns Promise)

#### Location

- **`getCurrentPosition(options?)`** — Get current location (one-time, returns Promise)
- **`useWatchPosition(options)`** — Real-time location tracking (React Hook)

#### Low-level (Advanced)

- **`watchPosition(onUpdate, onError?, options?)`** — Subscribe to location updates (returns token)
- **`unwatch(token)`** — Stop specific watch subscription
- **`stopObserving()`** — Stop ALL watch subscriptions

See [Modern API Documentation](https://react-native-nitro-geolocation.pages.dev/guide/modern-api) for details.

---

### Legacy API (via `/compat`)

- **`setRNConfiguration()`** — Set configuration options
- **`requestAuthorization()`** — Request location permission
- **`getCurrentPosition()`** — Get current location (callback-based)
- **`watchPosition()`** — Subscribe to location updates
- **`clearWatch()`** — Stop watching by ID
- **`stopObserving()`** — Stop all watchers

See [Legacy API Documentation](https://react-native-nitro-geolocation.pages.dev/guide/legacy-api) for details.

---

## 📊 Performance Benchmarks

Performance comparison between Nitro (JSI) and Community (Bridge):

**Test Environment**:
- Device: iPhone 14 Pro (iOS Simulator)
- React Native: 0.76.x
- Test: 1000 iterations × 5 runs of `getCurrentPosition` with cached location

### Results

| Metric | Nitro | Community | Improvement |
|--------|-------|-----------|-------------|
| **Average** | 0.019ms | 0.436ms | **22.95x faster** |
| **Median** | 0.017ms | 0.045ms | 62.2% faster |
| **Min** | 0.014ms | 0.034ms | 58.8% faster |
| **Max** | 1.007ms | 10.577ms | 90.5% faster |
| **P95** | 0.025ms | 6.434ms | **257.4x faster** |
| **P99** | 0.031ms | 7.271ms | **234.5x faster** |
| **Std Dev** | 0.032ms | 1.545ms | 98.0% more stable |

### Why is Nitro faster?

1. **Zero Queue Overhead**: Cached responses return immediately
2. **Direct JSI Calls**: No JSON serialization or async bridge crossing
3. **Optimized Architecture**: Fast path for cached responses

[See full benchmark details](https://react-native-nitro-geolocation.pages.dev/guide/benchmark)

---

## ✨ Features

### Modern API Features

- 🎯 **Simple and Direct** — Direct function calls, no complex abstractions
- 🪝 **Single Hook** — Only one hook for continuous tracking
- 🧹 **Auto-cleanup** — No manual subscription management
- 📘 **TypeScript-first** — Full type inference
- 🔋 **Battery efficient** — Native subscriptions stop immediately when disabled

### Technical Features

- ⚡ **JSI-powered** — Direct native calls without Bridge
- 🚀 **High performance** — 22.95x faster average latency
- 📱 **Cross-platform** — Consistent iOS/Android behavior
- 🔒 **Type-safe** — Complete TypeScript definitions
- 🧪 **Well-tested** — Comprehensive test coverage

---

## 🧪 Summary

**React Native Nitro Geolocation** provides a simple, modern geolocation API:

1. **Modern API**: Simple functions + one hook for tracking
2. **Legacy API**: 100% compatible with `@react-native-community/geolocation`
3. **Performance**: JSI-powered direct callbacks — up to 22.95x faster
4. **Developer Experience**: Simple API, automatic cleanup, battery-efficient, full TypeScript support

Choose the API that fits your project:
- **New projects** → Modern API (Direct functions + Hook)
- **Migrating from community package** → Legacy API (`/compat`)
- **Best performance** → Both use the same JSI foundation

---

## 📖 Learn More

- [Introduction](https://react-native-nitro-geolocation.pages.dev/guide/)
- [Quick Start Guide](https://react-native-nitro-geolocation.pages.dev/guide/quick-start)
- [Modern API Reference](https://react-native-nitro-geolocation.pages.dev/guide/modern-api)
- [Legacy API Reference](https://react-native-nitro-geolocation.pages.dev/guide/legacy-api)
- [DevTools Plugin Guide](https://react-native-nitro-geolocation.pages.dev/guide/devtools)
- [Why Nitro Module?](https://react-native-nitro-geolocation.pages.dev/guide/why-nitro-module)
- [Benchmark Results](https://react-native-nitro-geolocation.pages.dev/guide/benchmark)

---

## License

MIT
