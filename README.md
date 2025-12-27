# react-native-nitro-geolocation

[![NPM](https://img.shields.io/npm/v/react-native-nitro-geolocation)](https://www.npmjs.com/package/react-native-nitro-geolocation)

**Modern React Hooks for Geolocation** — Powered by Nitro Modules with JSI

A complete reimplementation of [`@react-native-community/geolocation`](https://github.com/michalchudziak/react-native-geolocation) for the React Native New Architecture, featuring:

- 🪝 **TanStack Query-inspired Hooks** for modern React patterns
- ⚡ **JSI-powered performance** with direct native calls
- 🔁 **100% API compatibility** via `/compat` for easy migration
- 🧹 **Automatic cleanup** — no manual subscription management
- 📱 **Consistent behavior** across iOS and Android

![react-native-nitro-geolocation](https://raw.githubusercontent.com/jingjing2222/react-native-nitro-geolocation/main/demo.gif)

---

## 📘 Documentation

Full documentation available at:
👉 [https://react-native-nitro-geolocation.pages.dev](https://react-native-nitro-geolocation.pages.dev)

---

## 🧭 Introduction

React Native Nitro Geolocation provides **two APIs** to fit your needs:

### 1. Modern API (Recommended)

**TanStack Query-inspired** Hooks with Provider pattern for modern React apps:

```tsx
import {
  GeolocationClient,
  GeolocationClientProvider,
  useWatchPosition,
  useGetCurrentPosition,
  useRequestPermission
} from 'react-native-nitro-geolocation';

// Setup once at app root
const client = new GeolocationClient({
  authorizationLevel: 'whenInUse',
  locationProvider: 'auto'
});

function App() {
  return (
    <GeolocationClientProvider client={client}>
      <YourApp />
    </GeolocationClientProvider>
  );
}

// Use hooks anywhere
function LocationTracker() {
  const { data, isWatching } = useWatchPosition({
    enabled: true,
    enableHighAccuracy: true
  });

  return (
    <Text>
      {data?.coords.latitude}, {data?.coords.longitude}
    </Text>
  );
}
```

**Benefits**:
- ✅ Declarative `enabled` prop instead of imperative start/stop
- ✅ Automatic cleanup when component unmounts
- ✅ Provider-based configuration
- ✅ Full TypeScript inference

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
  ↓ useWatchPosition({ enabled: true })
  ↓ Declarative Hooks (TanStack Query-inspired)
GeolocationClient + Provider
  ↓ Provider context
  ↓ Subscription management
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

#### Modern (Direct Callback via Nitro + Hooks)

```
JavaScript
  ↓ useWatchPosition() → client.watchPosition(callback)
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
- React Hooks with automatic lifecycle management
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

### 4. Usage Examples

#### Modern API (Recommended)

**Setup Provider**:

```tsx
import {
  GeolocationClient,
  GeolocationClientProvider
} from 'react-native-nitro-geolocation';

const geolocationClient = new GeolocationClient({
  authorizationLevel: 'whenInUse',
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

**Request Permission**:

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

**Get Current Position**:

```tsx
import { useGetCurrentPosition } from 'react-native-nitro-geolocation';

function LocationButton() {
  const { getCurrentPosition } = useGetCurrentPosition();
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    setLoading(true);
    try {
      const position = await getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000
      });
      console.log('Lat:', position.coords.latitude);
      console.log('Lng:', position.coords.longitude);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return <Button onPress={handlePress} disabled={loading} />;
}
```

**Watch Position (Real-time Tracking)**:

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
      <Switch value={enabled} onValueChange={setEnabled} />
      {isWatching && data && (
        <Text>
          {data.coords.latitude}, {data.coords.longitude}
          {'\n'}Accuracy: {data.coords.accuracy}m
        </Text>
      )}
    </View>
  );
}
```

**Standalone Client Usage (without Provider)**:

For one-off tasks or use outside of React components, you can use the client directly.

```tsx
import { GeolocationClient } from 'react-native-nitro-geolocation';

const client = new GeolocationClient({
  authorizationLevel: 'whenInUse', // Example config
  locationProvider: 'auto',        // Example config
});

async function fetchLocation() {
  try {
    const position = await client.getCurrentPosition();
    console.log(position);
  } catch (e) {
    console.error(e);
  }
}
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

Upgrade to hooks for better developer experience:

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
const { data } = useWatchPosition({
  enabled: true,
  enableHighAccuracy: true
});
// Auto cleanup, no watch ID management needed!
```

**70% less code** with automatic cleanup and declarative patterns.

---

## 🧠 API Reference

### Modern API

#### Components & Client

- **`GeolocationClient`** — Client instance for configuration
- **`GeolocationClientProvider`** — React Context provider

#### Hooks

- **`useCheckPermission()`** — Check current permission status
- **`useRequestPermission()`** — Request location permission
- **`useGetCurrentPosition()`** — Get current location (one-time)
- **`useWatchPosition({ enabled })`** — Real-time location tracking

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

- 🪝 **TanStack Query-inspired** — Familiar patterns for React developers
- 🎯 **Declarative** — `{ enabled }` prop instead of imperative start/stop
- 🧹 **Auto-cleanup** — No manual `clearWatch()` required
- 🔌 **Provider pattern** — Configure once at app root
- 📘 **TypeScript-first** — Full type inference

### Technical Features

- ⚡ **JSI-powered** — Direct native calls without Bridge
- 🚀 **High performance** — 22.95x faster average latency
- 📱 **Cross-platform** — Consistent iOS/Android behavior
- 🔒 **Type-safe** — Complete TypeScript definitions
- 🧪 **Well-tested** — Comprehensive test coverage

---

## 🧪 Summary

**React Native Nitro Geolocation** transforms geolocation into a modern React experience:

1. **Modern API**: TanStack Query-inspired Hooks with automatic lifecycle management
2. **Legacy API**: 100% compatible with `@react-native-community/geolocation`
3. **Performance**: JSI-powered direct callbacks — up to 22.95x faster
4. **Developer Experience**: Declarative patterns, automatic cleanup, full TypeScript support

Choose the API that fits your project:
- **New projects** → Modern API (Hooks + Provider)
- **Migrating from community package** → Legacy API (`/compat`)
- **Best performance** → Both use the same JSI foundation

---

## 📖 Learn More

- [Introduction](https://react-native-nitro-geolocation.pages.dev/guide/)
- [Quick Start Guide](https://react-native-nitro-geolocation.pages.dev/guide/quick-start)
- [Modern API Reference](https://react-native-nitro-geolocation.pages.dev/guide/modern-api)
- [Legacy API Reference](https://react-native-nitro-geolocation.pages.dev/guide/legacy-api)
- [Why Nitro Module?](https://react-native-nitro-geolocation.pages.dev/guide/why-nitro-module)
- [Benchmark Results](https://react-native-nitro-geolocation.pages.dev/guide/benchmark)

---

## License

MIT
