
[![NPM](https://img.shields.io/npm/v/react-native-nitro-geolocation)](https://www.npmjs.com/package/react-native-nitro-geolocation)
A **Nitro-powered, JSI-based reimplementation** of
[`@react-native-community/geolocation`](https://github.com/michalchudziak/react-native-geolocation)
for the **React Native New Architecture** — with 100% API compatibility.

![react-native-nitro-geolocation](https://raw.githubusercontent.com/jingjing2222/react-native-nitro-geolocation/main/demo.gif)
**Modern React Hooks for Geolocation** — Powered by Nitro Modules with JSI

A complete reimplementation of [`@react-native-community/geolocation`](https://github.com/michalchudziak/react-native-geolocation) for the React Native New Architecture, featuring:

- 🪝 **TanStack Query-inspired Hooks** for modern React patterns
- ⚡ **JSI-powered performance** with direct native calls
- 🔁 **100% API compatibility** via `/compat` for easy migration
- 🧹 **Automatic cleanup** — no manual subscription management
- 📱 **Consistent behavior** across iOS and Android

![react-native-nitro-geolocation](https://raw.githubusercontent.com/jingjing2222/react-native-nitro-geolocation/main/demo.gif)

---

## 🧭 Introduction

The `@react-native-community/geolocation` package has long been the standard way to access device location in React Native apps.
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

With React Native moving toward **Nitro Modules**, **Fabric**, and **JSI**,
this project — **React Native Nitro Geolocation** — brings the same familiar API to the new architecture.
const watchId = Geolocation.watchPosition(
  (position) => console.log(position)
);
Geolocation.clearWatch(watchId);
```

It provides the **same API surface** with:
---

- 🚀 Faster performance via direct **JSI bindings**
- 📱 Improved native consistency (Android + iOS)
- 🔁 Seamless migration from `@react-native-community/geolocation`
- 🧩 TypeScript-first developer experience
- 🔄 100% API compatibility (drop-in replacement)
## 🏗 Architecture

Whether upgrading an existing app or building a new one,
**React Native Nitro Geolocation** keeps the simplicity you know — with modern internals.
### Modern API Architecture

## 🏗 Architecture Comparison
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

- See [Benchmark Results](https://react-native-nitro-geolocation.pages.dev/guide/benchmark.html) for detailed performance comparison
### Legacy vs Modern Comparison

### 🧩 Origin: Event-based Architecture (`@react-native-community/geolocation`)
#### Legacy (Event-based, `@react-native-community/geolocation`)

~~~
```
JavaScript
  ↓ EventEmitter.addListener('geolocationDidChange', callback)
  ↓ (Callback stored in JS)
React Native Bridge (JSON serialization)
  ↓
Native Layer (Android/iOS)
  ↓ LocationListener receives updates
Native Layer
  ↓ emit('geolocationDidChange', data)
  ↓
EventEmitter dispatches to all listeners
  ↓
User callback executed
~~~

**Key traits:**
- Callbacks stored only in JS
- Bridge serialization on every update
- One shared event stream

---
EventEmitter → User callback
```

### ⚡ Modern: Direct Callback Architecture (`react-native-nitro-geolocation`)
#### Modern (Direct Callback via Nitro + Hooks)

~~~
```
JavaScript
  ↓ Geolocation.watchPosition(success, error)
  ↓ (Callbacks passed directly to native via JSI)
  ↓ useWatchPosition() → client.watchPosition(callback)
JSI Layer (No Bridge!)
  ↓
Native Layer (Kotlin/Swift)
  ↓ callback.success(position) → JSI direct call
Native Layer
  ↓ callback(position) → JSI direct call
  ↓
User callback executed immediately
~~~
```

**Key traits:**
- Callbacks passed as native JSI references
- No Bridge serialization
- Independent callback per watcher
- Native → JS communication in real time
**Key advantages**:
- Callbacks passed directly to native via JSI
- No Bridge serialization overhead
- React Hooks with automatic lifecycle management
- Independent callbacks per watcher

---

### 1. Installation

~~~bash
```bash
# Install Nitro core and Geolocation module
yarn add react-native-nitro-modules react-native-nitro-geolocation
yarn add react-native-nitro-modules@">=0.32.0" react-native-nitro-geolocation

# or using npm
npm install react-native-nitro-modules react-native-nitro-geolocation
~~~
npm install react-native-nitro-modules@">=0.32.0" react-native-nitro-geolocation
```

After installation, rebuild your native app:
Rebuild your native app:

~~~bash
```bash
cd ios && pod install
~~~
```

---

### 2. iOS Setup

Add the following permissions to your **Info.plist**:
Add permissions to your **Info.plist**:

~~~xml
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app requires access to your location while it’s in use.</string>
<string>This app requires access to your location while it's in use.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app requires access to your location at all times.</string>
~~~
```

---

### 3. Android Setup

Add these permissions to your **AndroidManifest.xml**:
Add permissions to **AndroidManifest.xml**:

~~~xml
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
~~~
```

Optional (for background access):
Optional (for background):

~~~xml
```xml
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
~~~
```

---

### 4. Usage Example
### 4. Usage Examples

~~~tsx
import Geolocation from 'react-native-nitro-geolocation';
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
  (error) => console.error(error),
);
~~~

---

### Migrating from `@react-native-community/geolocation`

Nitro Geolocation is **100% API-compatible** with the original package.
You can migrate simply by replacing imports:

~~~diff
- import Geolocation from '@react-native-community/geolocation';
+ import Geolocation from 'react-native-nitro-geolocation';
~~~

**Benefits:**
- Better performance via JSI
- Reduced bridge overhead
- Improved permission consistency
- Built-in TypeScript definitions
// Don't forget cleanup!
Geolocation.clearWatch(watchId);
```

---

## 🧠 API Methods
## 🔄 Migration Guide

### Summary
- `setRNConfiguration`
- `requestAuthorization`
- `getCurrentPosition`
- `watchPosition`
- `clearWatch`
- `stopObserving`
### From `@react-native-community/geolocation`

---

### `setRNConfiguration()`

Sets configuration options used for all location requests.

~~~tsx
import Geolocation from 'react-native-nitro-geolocation';

Geolocation.setRNConfiguration({
  skipPermissionRequests: false,
  authorizationLevel: 'auto',
  enableBackgroundLocationUpdates: true,
  locationProvider: 'auto',
});
Simply change the import path to use the `/compat` subpath:

// recommended
import { setRNConfiguration } from 'react-native-nitro-geolocation';

setRNConfiguration({
  skipPermissionRequests: false,
  authorizationLevel: 'auto',
  enableBackgroundLocationUpdates: true,
  locationProvider: 'auto',
});
~~~

**Options:**
- `skipPermissionRequests` — default `false`
- `authorizationLevel` — `'always' | 'whenInUse' | 'auto'` *(iOS only)*
- `enableBackgroundLocationUpdates` — *(iOS only)*
- `locationProvider` — `'playServices' | 'android' | 'auto'` *(Android only)*

---

### `requestAuthorization()`

Requests location permission from the system.
```diff
- import Geolocation from '@react-native-community/geolocation';
+ import Geolocation from 'react-native-nitro-geolocation/compat';
```

~~~tsx
import Geolocation from 'react-native-nitro-geolocation';
**All methods work identically** — 100% API compatible!

Geolocation.requestAuthorization(
  () => console.log('Permission granted'),
  (error) => console.error('Permission error:', error),
);
### To Modern API (Recommended)

// recommended
import { requestAuthorization } from 'react-native-nitro-geolocation';

requestAuthorization(
  () => console.log('Permission granted'),
  (error) => console.error('Permission error:', error),
);
~~~
Upgrade to hooks for better developer experience:

---
**Before (Legacy)**:

### `getCurrentPosition()`
```tsx
const [position, setPosition] = useState(null);
const watchIdRef = useRef(null);

Retrieves the current device location once.
useEffect(() => {
  watchIdRef.current = Geolocation.watchPosition(
    (pos) => setPosition(pos),
    (err) => console.error(err),
    { enableHighAccuracy: true }
  );

~~~tsx
import Geolocation from 'react-native-nitro-geolocation';
  return () => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
    }
  };
}, []);
```

Geolocation.getCurrentPosition(
  (position) => console.log(position),
  (error) => console.error(error),
  { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
);
**After (Modern)**:

// recommended
import { getCurrentPosition } from 'react-native-nitro-geolocation';
```tsx
const { data } = useWatchPosition({
  enabled: true,
  enableHighAccuracy: true
});
// Auto cleanup, no watch ID management needed!
```

getCurrentPosition(
  (position) => console.log(position),
  (error) => console.error(error),
  { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
);
~~~
**70% less code** with automatic cleanup and declarative patterns.

---

### `watchPosition()`
## 🧠 API Reference

Watches location changes and calls the success callback each time.
### Modern API

~~~tsx
import Geolocation from 'react-native-nitro-geolocation';
#### Components & Client

const id = Geolocation.watchPosition(
  (position) => console.log('Position:', position),
  (error) => console.error(error),
  { interval: 5000, distanceFilter: 10 },
);
- **`GeolocationClient`** — Client instance for configuration
- **`GeolocationClientProvider`** — React Context provider

// recommended
import { watchPosition } from 'react-native-nitro-geolocation';
#### Hooks

const id = watchPosition(
  (position) => console.log('Position:', position),
  (error) => console.error(error),
  { interval: 5000, distanceFilter: 10 },
);
- **`useCheckPermission()`** — Check current permission status
- **`useRequestPermission()`** — Request location permission
- **`useGetCurrentPosition()`** — Get current location (one-time)
- **`useWatchPosition({ enabled })`** — Real-time location tracking

~~~
See [Modern API Documentation](https://react-native-nitro-geolocation.pages.dev/guide/modern-api) for details.

---

### `clearWatch()`

Stops watching location updates for a given watch ID.
### Legacy API (via `/compat`)

~~~tsx
import Geolocation from 'react-native-nitro-geolocation';
Geolocation.clearWatch(id);
- **`setRNConfiguration()`** — Set configuration options
- **`requestAuthorization()`** — Request location permission
- **`getCurrentPosition()`** — Get current location (callback-based)
- **`watchPosition()`** — Subscribe to location updates
- **`clearWatch()`** — Stop watching by ID
- **`stopObserving()`** — Stop all watchers

// recommended
import { clearWatch } from 'react-native-nitro-geolocation';
clearWatch(id);
~~~
See [Legacy API Documentation](https://react-native-nitro-geolocation.pages.dev/guide/legacy-api) for details.

---

## 📊 Performance Benchmarks

Performance comparison between `react-native-nitro-geolocation` (Nitro) and `@react-native-community/geolocation` (Community).
Performance comparison between Nitro (JSI) and Community (Bridge):

**Test Environment:**
- Device: iPhone (iOS Simulator)
**Test Environment**:
- Device: iPhone 14 Pro (iOS Simulator)
- React Native: 0.76.x
- Test: 1000 iterations × 5 runs of `getCurrentPosition` with cached location (measuring pure bridge/JSI latency)
- Test: 1000 iterations × 5 runs of `getCurrentPosition` with cached location

### Results

| **P99** | 0.031ms | 7.271ms | **234.5x faster** |
| **Std Dev** | 0.032ms | 1.545ms | 98.0% more stable |
| **Samples** | 1000 | 1000 | - |

### Why is Nitro faster?

1. **Zero Queue Overhead**: Cached location responses return immediately without any dispatch queue overhead
1. **Zero Queue Overhead**: Cached responses return immediately
2. **Direct JSI Calls**: No JSON serialization or async bridge crossing
3. **Optimized Architecture**: Fast path for cached responses, queue-free delegate callbacks
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

**React Native Nitro Geolocation** transforms the geolocation API
from a bridge-based, event-driven system into a **JSI-powered direct-callback model** —
delivering native-level performance with **zero API changes** for developers.
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

The [`@react-native-community/geolocation`](https://github.com/michalchudziak/react-native-geolocation) package has been the standard way to access device location in React Native apps.

With the React Native ecosystem moving toward **TurboModules**, **Fabric**, and **JSI-based architecture**, we saw an opportunity to bring the same familiar API to the new architecture.
With the React Native ecosystem moving toward **TurboModules**, **Fabric**, and **JSI-based architecture**, we saw an opportunity to bring geolocation to the new architecture while improving the developer experience.

This project — **React Native Nitro Geolocation** — is a reimplementation of that library, designed for the **Nitro Module** system.
It provides the same familiar API surface while delivering:
This project — **React Native Nitro Geolocation** — is a complete reimplementation designed for the **Nitro Module** system, providing **two APIs** to fit your needs:

- 🚀 **Faster performance** through direct JSI bindings
- 📱 **Improved native consistency** across Android and iOS
- 🔁 **Seamless migration** from `@react-native-community/geolocation`
- 🧩 **TypeScript-first** developer experience
- 🔄 **100% API compatibility** — React Native Nitro Geolocation can be used as a **drop-in replacement**, fully substituting `@react-native-community/geolocation` without any code changes
## 1. Modern API (Recommended)

**TanStack Query-inspired** Hooks + Provider pattern for modern React apps.

```tsx
import {
  GeolocationClient,
  GeolocationClientProvider,
  useWatchPosition,
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

  return <Text>{data?.coords.latitude}, {data?.coords.longitude}</Text>;
}
```

**Key Features**:
- 🪝 Declarative permission handling
- 🧹 Auto-cleanup location tracking
- 🔌 Provider-based configuration
- 📘 Full TypeScript support with inference

## 2. Legacy API (Compatibility)

**100% compatible** with `@react-native-community/geolocation` via `/compat` subpath.

```tsx
import Geolocation from 'react-native-nitro-geolocation/compat';

Geolocation.getCurrentPosition(
  (position) => console.log(position),
  (error) => console.error(error),
  { enableHighAccuracy: true }
);
```

**Use cases**:
- Drop-in replacement for existing apps
- Minimal migration effort
- Callback-based API preference

---

## Why Modern API?

The Modern API brings React best practices to geolocation:

### Declarative vs Imperative

**Before (Imperative)**:
```tsx
const [position, setPosition] = useState(null);
const watchIdRef = useRef(null);

useEffect(() => {
  watchIdRef.current = Geolocation.watchPosition(
    (pos) => setPosition(pos),
    (err) => console.error(err)
  );

  return () => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
    }
  };
}, []);
```

**After (Declarative)**:
```tsx
const { data } = useWatchPosition({ enabled: true });
// Auto cleanup, no watch ID management needed!
```

### Key Benefits

Whether you're upgrading an existing app or building a new one using the latest React Native architecture, **React Native Nitro Geolocation** gives you the same simplicity — now with modern internals.
- **🎯 Declarative**: Use `{ enabled }` prop instead of imperative start/stop
- **🧹 Auto-cleanup**: No need to remember `clearWatch()` in `useEffect` cleanup
- **🔌 Provider pattern**: Configure once at app root, use anywhere
- **🪝 TanStack Query-inspired**: Familiar patterns for data fetching
- **📘 Type-safe**: Full TypeScript support with inference

---

## Motivation

The motivation behind React Native Nitro Geolocation is simple:
The motivation behind React Native Nitro Geolocation is twofold:

### 1. Modernize the Architecture

React Native has evolved with new architectural capabilities, and we wanted to bring these benefits to the Geolocation API.

`@react-native-community/geolocation` was built on the **bridge-based architecture**, which was the standard at the time. The new JSI-based architecture offers different characteristics:
- Enhanced TypeScript support and platform consistency

As React Native officially embraces **JSI** and **TurboModules**, we saw an opportunity to bring these capabilities to the Geolocation API while maintaining full compatibility with the existing package.
### 2. Improve Developer Experience

We drew inspiration from **TanStack Query** to create a geolocation API that:

- **Separates configuration from usage**: Provider pattern for app-wide config
- **Handles lifecycle automatically**: No manual cleanup required
- **Provides declarative control**: `{ enabled }` prop instead of start/stop
- **Embraces modern React patterns**: Hooks-first design
- **Ensures type safety**: Full TypeScript inference

---

## Design Philosophy

### TanStack Query Inspiration

Just as TanStack Query revolutionized data fetching in React, we aim to bring the same paradigm to geolocation:

| Concept | TanStack Query | Nitro Geolocation |
|---------|---------------|-------------------|
| **Provider** | `QueryClientProvider` | `GeolocationClientProvider` |
| **Client** | `QueryClient` | `GeolocationClient` |
| **Hooks** | `useQuery`, `useMutation` | `useGetCurrentPosition`, `useWatchPosition` |
| **Declarative** | `{ enabled }` option | `{ enabled }` option |
| **Auto-cleanup** | Automatic cache management | Automatic subscription cleanup |

### Core Principles

1. **Configuration at the top**: Set up once with Provider
2. **Declarative everywhere**: Use hooks with `{ enabled }` control
3. **Automatic lifecycle**: No manual cleanup code
4. **Type-safe by default**: Full TypeScript inference
5. **Performance first**: JSI-powered for native speed

---

## What You Get

Whether you choose Modern or Legacy API, you get:

- 🚀 **Faster performance** through direct JSI bindings (22.95x faster on average)
- 📱 **Improved native consistency** across Android and iOS
- 🔁 **Seamless migration** from `@react-native-community/geolocation`
- 🧩 **TypeScript-first** developer experience
- 🔄 **100% API compatibility** (via `/compat`) — can be used as a **drop-in replacement**

Whether you're upgrading an existing app or building a new one using the latest React Native architecture, **React Native Nitro Geolocation** gives you modern tools with proven performance.

---

## Next Steps

- [Quick Start Guide](/guide/quick-start) — Get up and running in minutes
- [Modern API Reference](/guide/modern-api) — Explore Hooks and Provider
- [Legacy API Reference](/guide/legacy-api) — Compatibility documentation
- [Why Nitro Module?](/guide/why-nitro-module) — Architecture deep dive
- [Benchmark Results](/guide/benchmark) — Performance comparison

# Methods

## Summary

* [`setRNConfiguration`](#setrnconfiguration)
* [`requestAuthorization`](#requestauthorization)
* [`getCurrentPosition`](#getcurrentposition)
* [`watchPosition`](#watchposition)
* [`clearWatch`](#clearwatch)
* [`stopObserving`](#stopobserving)

## Details

### `setRNConfiguration()`

Sets configuration options that will be used in all location requests.


```ts
Geolocation.setRNConfiguration(
  config: {
    skipPermissionRequests: boolean;
    authorizationLevel?: 'always' | 'whenInUse' | 'auto';
    enableBackgroundLocationUpdates?: boolean;
    locationProvider?: 'playServices' | 'android' | 'auto';
  }
) => void
```

Supported options:

* `skipPermissionRequests` (boolean) - Defaults to `false`. If `true`, you must request permissions before using Geolocation APIs.
* `authorizationLevel` (string, iOS-only) - Either `"whenInUse"`, `"always"`, or `"auto"`. Changes whether the user will be asked to give "always" or "when in use" location services permission. Any other value or `auto` will use the default behaviour, where the permission level is based on the contents of your `Info.plist`.
* `enableBackgroundLocationUpdates` (boolean, iOS-only) - When using `skipPermissionRequests`, toggle wether to automatically enableBackgroundLocationUpdates. Defaults to true.
* `locationProvider` (string, Android-only) - Either `"playServices"`, `"android"`, or `"auto"`.  Determines wether to use `Google’s Location Services API` or `Android’s Location API`. The `"auto"` mode defaults to `android`, and falls back to Android's Location API if play services aren't available.

### `requestAuthorization()`

Request suitable Location permission.

```ts
  Geolocation.requestAuthorization(
    success?: () => void,
    error?: (
      error: {
        code: number;
        message: string;
        PERMISSION_DENIED: number;
        POSITION_UNAVAILABLE: number;
        TIMEOUT: number;
      }
    ) => void
  )
```

On iOS if NSLocationAlwaysUsageDescription is set, it will request Always authorization, although if NSLocationWhenInUseUsageDescription is set, it will request InUse authorization.

### `getCurrentPosition()`

Invokes the success callback once with the latest location info.

```ts
  Geolocation.getCurrentPosition(
    success: (
      position: {
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
    ) => void,
    error?: (
      error: {
        code: number;
        message: string;
        PERMISSION_DENIED: number;
        POSITION_UNAVAILABLE: number;
        TIMEOUT: number;
      }
    ) => void,
    options?: {
        timeout?: number;
        maximumAge?: number;
        enableHighAccuracy?: boolean;
    }
  )
```


Supported options:

* `timeout` (ms) - Is a positive value representing the maximum length of time (in milliseconds) the device is allowed to take in order to return a position. Defaults to 10 minutes.
* `maximumAge` (ms) - Is a positive value indicating the maximum age in milliseconds of a possible cached position that is acceptable to return. If set to 0, it means that the device cannot use a cached position and must attempt to retrieve the real current position. If set to Infinity the device will always return a cached position regardless of its age. Defaults to INFINITY.
* `enableHighAccuracy` (bool) - Is a boolean representing if to use GPS or not. If set to true, a GPS position will be requested. If set to false, a WIFI location will be requested.

### `watchPosition()`

Invokes the success callback whenever the location changes. Returns a `watchId` (number).

```ts
  Geolocation.watchPosition(
    success: (
      position: {
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
    ) => void,
    error?: (
      error: {
        code: number;
        message: string;
        PERMISSION_DENIED: number;
        POSITION_UNAVAILABLE: number;
        TIMEOUT: number;
      }
    ) => void,
    options?: {
      interval?: number;
      fastestInterval?: number;
      timeout?: number;
      maximumAge?: number;
      enableHighAccuracy?: boolean;
      distanceFilter?: number;
      useSignificantChanges?: boolean;
    }
  ) => number
```

Supported options:

* `interval` (ms) -- (Android only) The rate in milliseconds at which your app prefers to receive location updates. Note that the location updates may be somewhat faster or slower than this rate to optimize for battery usage, or there may be no updates at all (if the device has no connectivity, for example).
* `fastestInterval` (ms) -- (Android only) The fastest rate in milliseconds at which your app can handle location updates. Unless your app benefits from receiving updates more quickly than the rate specified in `interval`, you don't need to set it.
* `timeout` (ms) - Is a positive value representing the maximum length of time (in milliseconds) the device is allowed to take in order to return a position. Defaults to 10 minutes.
* `maximumAge` (ms) - Is a positive value indicating the maximum age in milliseconds of a possible cached position that is acceptable to return. If set to 0, it means that the device cannot use a cached position and must attempt to retrieve the real current position. If set to Infinity the device will always return a cached position regardless of its age. Defaults to INFINITY.
* `enableHighAccuracy` (bool) - Is a boolean representing if to use GPS or not. If set to true, a GPS position will be requested. If set to false, a WIFI location will be requested.
* `distanceFilter` (m) - The minimum distance from the previous location to exceed before returning a new location. Set to 0 to not filter locations. Defaults to 100m.
* `useSignificantChanges` (bool) - Uses the battery-efficient native significant changes APIs to return locations. Locations will only be returned when the device detects a significant distance has been breached. Defaults to FALSE.

### `clearWatch()`

Clears watch observer by id returned by `watchPosition()`

```ts
Geolocation.clearWatch(watchID: number);
```

This guide walks you through installing and setting up **React Native Nitro Geolocation** in your React Native project.


## 1. Installation

Before installing the module, make sure you have a React Native environment (0.75+).

~~~bash
```bash
# Install Nitro core and Geolocation module
yarn add react-native-nitro-modules react-native-nitro-geolocation
yarn add react-native-nitro-modules@">=0.32.0" react-native-nitro-geolocation

# or using npm
npm install react-native-nitro-modules react-native-nitro-geolocation
~~~
npm install react-native-nitro-modules@">=0.32.0" react-native-nitro-geolocation
```

After installation, rebuild your native app to ensure the new module is linked.

~~~bash
```bash
cd ios && pod install
~~~
```

---

## 2. iOS Setup

Add the following keys to your **Info.plist**:

~~~xml
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app requires access to your location while it’s in use.</string>
<string>This app requires access to your location while it's in use.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app requires access to your location at all times.</string>
~~~
```

---

## 3. Android Setup

Add the following permissions to your **android/app/src/main/AndroidManifest.xml**:

~~~xml
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
~~~
```

Optional (for background access):

~~~xml
```xml
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
~~~
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

## 4. Usage Example
  return (
    <View>
      <Switch
        value={enabled}
        onValueChange={setEnabled}
        label="Track location"
      />

~~~tsx
import Geolocation from 'react-native-nitro-geolocation';
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
    console.log('Longitude:', position.coords.longitude);
  },
  (error) => {
    console.error('Location error:', error);
  },
  { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
  (error) => console.error('Location error:', error),
  { enableHighAccuracy: true, timeout: 15000 }
);

// Subscribe to updates
const watchId = Geolocation.watchPosition(
  (position) => {
    console.log('Updated position:', position);
  },
  (error) => console.error(error),
  (position) => console.log('Updated position:', position),
  (error) => console.error(error)
);

~~~
// Don't forget to cleanup!
Geolocation.clearWatch(watchId);
```

---

## 5. Migrating from `@react-native-community/geolocation`
## 6. Migration Guides

Nitro Geolocation is 100% API-compatible with `@react-native-community/geolocation`.
You can migrate by simply replacing imports:
### From `@react-native-community/geolocation`

~~~diff
Simply change the import path:

```diff
- import Geolocation from '@react-native-community/geolocation';
+ import Geolocation from 'react-native-nitro-geolocation';
~~~
+ import Geolocation from 'react-native-nitro-geolocation/compat';
```

or

~~~diff
```diff
- import { getCurrentPosition, watchPosition } from '@react-native-community/geolocation';
+ import { getCurrentPosition, watchPosition } from 'react-native-nitro-geolocation';
~~~
+ import { getCurrentPosition, watchPosition } from 'react-native-nitro-geolocation/compat';
```

Most existing code will work as-is — but you'll now get:
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

- Minimal serialization (C++ structs → JS objects)

## Modern Hooks Layer

React Native Nitro Geolocation now provides a modern React-friendly layer on top of the JSI architecture:

```
User Code (React Components)
  ↓ useWatchPosition({ enabled: true })
  ↓ Declarative, auto-cleanup
Modern API Layer (GeolocationClient + Hooks)
  ↓ client.watchPosition(callback)
  ↓ Provider context
JSI Layer (Nitro Modules)
  ↓ Direct callbacks, no Bridge
Native Layer (Kotlin/Swift)
  ↓ CLLocationManager / FusedLocationProvider
Device GPS/Network
```

**Benefits of Modern Hooks Layer**:
- **TanStack Query-inspired**: Familiar patterns for React developers
- **Declarative**: `{ enabled }` prop instead of imperative start/stop
- **Auto-cleanup**: No manual `clearWatch()` required
- **Type-safe**: Full TypeScript inference
- **Best practices**: Encourages proper React patterns

**Architecture Layers**:
1. **Presentation** (Hooks): `useWatchPosition`, `useGetCurrentPosition`
2. **Business Logic** (Client): `GeolocationClient` manages state
3. **JSI Bridge** (Nitro): Direct native communication
4. **Native** (Platform): iOS/Android location APIs

## How JSI Enables Direct Callbacks

Nitro Modules use **Nitrogen** code generation to create JSI bindings:
## Summary

`React Native Nitro Geolocation` transforms the geolocation API from a **Bridge-mediated event system** to a **JSI-powered direct callback system**, delivering native-level performance while maintaining 100% API compatibility with the original library.
`React Native Nitro Geolocation` transforms the geolocation API at multiple levels:

1. **Low-level**: Bridge-based events → JSI direct callbacks (Nitro Modules)
2. **High-level**: Imperative callbacks → Declarative hooks (Modern API)

This provides:
- **Performance**: Native-level speed via JSI
- **Developer Experience**: React-friendly hooks with TanStack Query patterns
- **Flexibility**: Choose Modern API (hooks) or Legacy API (callbacks)
- **Compatibility**: 100% backward compatible via `/compat`

  name: React Native Nitro Geolocation
  text: A React Native Geolocation module
  tagline: Native geolocation, now Nitro-powered.
  tagline: Native geolocation with React Hooks, powered by Nitro.
  actions:
    - theme: brand
      text: Introduction

features:
  - title: TanStack Query-inspired Hooks
    details: Modern React patterns with Provider + Hooks for declarative geolocation and automatic lifecycle management.
    icon: ⚛️
  - title: Fully native implementation
    details: Access device geolocation data through JSI and Nitro Modules for maximum performance.
    icon: 📡
  - title: Drop-in replacement
    details: Provides the same API surface as @react-native-community/geolocation for easy migration.
  - title: Drop-in replacement (via /compat)
    details: Legacy API provides 100% compatibility with @react-native-community/geolocation for easy migration.
    icon: 🔁
  - title: Consistent Android & iOS behavior
    details: Unified permission handling, background location consistency, and improved accuracy tuning.
    details: Built with Nitro Modules, enabling direct JS-to-native calls without bridge serialization overhead.
    icon: ⚙️
  - title: Automatic cleanup
    details: useWatchPosition automatically manages subscriptions with component lifecycle—no manual cleanup needed.
    icon: 🧹
  - title: TypeScript ready
    details: Full type definitions for getCurrentPosition, watchPosition, and clearWatch APIs.
    details: Full type definitions for all APIs with complete type inference for Modern Hooks.
    icon: 📘
  - title: Easy integration
    details: Compatible with Expo modules, RN CLI, and custom native builds out of the box.
          "https://github.com/jingjing2222/react-native-nitro-geolocation"
      }
    ]
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/guide/' },
            { text: 'Quick Start', link: '/guide/quick-start' },
          ]
        },
        {
          text: 'API Reference',
          items: [
            {
              text: 'Modern API (Recommended)',
              link: '/guide/modern-api'
            },
            {
              text: 'Legacy API (Compat)',
              link: '/guide/legacy-api'
            },
          ]
        },
        {
          text: 'Learn More',
          items: [
            { text: 'Why Nitro Module?', link: '/guide/why-nitro-module' },
            { text: 'Benchmark', link: '/guide/benchmark' },
          ]
        }
      ]
    }
  }
});
