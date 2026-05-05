# Introduction

The [`@react-native-community/geolocation`](https://github.com/michalchudziak/react-native-geolocation) package has been the standard way to access device location in React Native apps.

With the React Native ecosystem moving toward **TurboModules**, **Fabric**, and **JSI-based architecture**, we saw an opportunity to bring geolocation to the new architecture while improving the developer experience.

This project — **React Native Nitro Geolocation** — is a native iOS/Android
module designed for the **Nitro Module** system. It is best positioned as a
React Native 0.75+ / New Architecture path for replacing the core native
`@react-native-community/geolocation` API with `/compat`, then gradually moving
to a typed Modern API.

## When should I use this?

| Use case | Recommendation |
| --- | --- |
| Bare React Native 0.75+ app | Use Nitro Geolocation |
| Migrating from `@react-native-community/geolocation` | Start with `/compat` |
| New Architecture / Nitro-based app | Recommended |
| Expo development build or custom native build | Supported with native setup |
| Expo managed app without native rebuild | Use `expo-location` |
| Web support required | Use `@react-native-community/geolocation` or `expo-location` for now |
| Full background tracking / geofencing | Use a dedicated background-location library |

Web is not supported in `v1.2.x`. The community package handles web by
delegating to the browser `navigator.geolocation` API; this package currently
targets native Nitro bindings. A `/compat` web fallback is planned for `v1.3`.

React Native Nitro Geolocation provides **two APIs** to fit your needs:

## 1. Modern API (Recommended)

**Simple functional API** with direct calls and minimal abstractions.

```tsx
import {
  setConfiguration,
  requestPermission,
  getCurrentPosition,
  geocode,
  reverseGeocode,
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

// Convert between addresses and coordinates
const locations = await geocode('City Hall, Seoul, South Korea');
const addresses = await reverseGeocode({
  latitude: 37.5665,
  longitude: 126.978
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

**Key Features**:
- 🎯 Simple and direct — No complex abstractions
- 🪝 Single hook for continuous tracking
- 🧹 Auto-cleanup when component unmounts
- 📘 Full TypeScript support

## 2. Compat API (Compatibility)

Drop-in compatible with the core native `@react-native-community/geolocation`
API via the `/compat` subpath.

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


## Why Modern API?

The Modern API brings simplicity and React hook patterns to geolocation:

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
const { position } = useWatchPosition({ enabled: true });
// Auto cleanup, no watch ID management needed!
```

### Key Benefits

- **🎯 Simple and Direct**: Just functions and one hook
- **🧹 Auto-cleanup**: No need to remember `clearWatch()` in `useEffect` cleanup
- **🪝 Single Hook**: Only `useWatchPosition` for continuous tracking
- **📘 Type-safe**: Full TypeScript support with inference
- **⚡ High Performance**: JSI-powered for native speed


## Motivation

The motivation behind React Native Nitro Geolocation is twofold:

### 1. Update the Architecture

React Native has evolved with new architectural capabilities, and we wanted to bring these benefits to the Geolocation API.

`@react-native-community/geolocation` was built on the **bridge-based architecture**, which was the standard at the time. The new JSI-based architecture offers different characteristics:

- Direct communication between JS and native layers
- Support for synchronous APIs when needed
- Better integration with concurrent React and Fabric
- Enhanced TypeScript support and platform consistency

### 2. Improve Developer Experience

We created a geolocation API that:

- **Simple configuration**: Call `setConfiguration()` once
- **Direct function calls**: No classes or complex abstractions
- **Handles lifecycle automatically**: No manual cleanup required
- **Provides declarative control**: `{ enabled }` prop instead of start/stop
- **Ensures type safety**: Full TypeScript inference


## Design Philosophy

### Simple and Functional

Instead of complex provider patterns or class-based APIs, we provide:

| Concept | Modern API |
|---------|------------|
| **Configuration** | `setConfiguration()` |
| **Permission** | `checkPermission()`, `requestPermission()` |
| **Location** | `getCurrentPosition()`, `useWatchPosition()` |
| **Geocoding** | `geocode()`, `reverseGeocode()` |
| **Cleanup** | Automatic (in hook) |

### Core Principles

1. **Configuration at startup**: Set up once with `setConfiguration()`
2. **Direct function calls**: Use Promise-based functions directly
3. **Single hook for tracking**: `useWatchPosition` handles continuous updates
4. **Automatic lifecycle**: No manual cleanup code
5. **Type-safe by default**: Full TypeScript inference
6. **Performance first**: JSI-powered for native speed


## What You Get

Whether you choose Modern or Compat API, you get:

- 🚀 **Lower cached-read overhead** through direct JSI bindings
- 📱 **Improved native consistency** across Android and iOS
- 🔁 **Seamless migration** from `@react-native-community/geolocation`
- 🧩 **TypeScript-first** developer experience
- 🔄 **Compat API** (via `/compat`) for the core native community geolocation surface

The benchmark measures cached location reads and the JS-to-native call path. It
does not make cold GPS acquisition itself 22x faster.

Whether you're upgrading an existing app or building a new one using the latest React Native architecture, **React Native Nitro Geolocation** gives you the Modern API with a migration-friendly compat path.


## Next Steps

- [Quick Start Guide](/guide/quick-start) — Get up and running in minutes
- [Migration Demo](/guide/migration-demo) — Move from community imports to `/compat` and Modern API
- [Expo Development Build Guide](/guide/expo-development-build) — Use the package in Expo custom native builds
- [Modern API Reference](/guide/modern-api) — Explore functions and hooks
- [Compat API Reference](/guide/compat-api) — Compatibility documentation
- [Why Nitro Module?](/guide/why-nitro-module) — Architecture deep dive
- [Benchmark Results](/guide/benchmark) — Performance comparison
