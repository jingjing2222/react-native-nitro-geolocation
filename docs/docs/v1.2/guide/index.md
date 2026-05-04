# Introduction

The [`@react-native-community/geolocation`](https://github.com/michalchudziak/react-native-geolocation) package has been the standard way to access device location in React Native apps.

With the React Native ecosystem moving toward **TurboModules**, **Fabric**, and **JSI-based architecture**, we saw an opportunity to bring geolocation to the new architecture while improving the developer experience.

This project — **React Native Nitro Geolocation** — is a complete reimplementation designed for the **Nitro Module** system, providing **two APIs** to fit your needs:

## 1. Modern API (Recommended)

**Simple functional API** with direct calls and minimal abstractions.

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

**Key Features**:
- 🎯 Simple and direct — No complex abstractions
- 🪝 Single hook for continuous tracking
- 🧹 Auto-cleanup when component unmounts
- 📘 Full TypeScript support

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


## Why Modern API?

The Modern API brings simplicity and modern React patterns to geolocation:

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

### 1. Modernize the Architecture

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
| **Cleanup** | Automatic (in hook) |

### Core Principles

1. **Configuration at startup**: Set up once with `setConfiguration()`
2. **Direct function calls**: Use Promise-based functions directly
3. **Single hook for tracking**: `useWatchPosition` handles continuous updates
4. **Automatic lifecycle**: No manual cleanup code
5. **Type-safe by default**: Full TypeScript inference
6. **Performance first**: JSI-powered for native speed


## What You Get

Whether you choose Modern or Legacy API, you get:

- 🚀 **Faster performance** through direct JSI bindings (22.95x faster on average)
- 📱 **Improved native consistency** across Android and iOS
- 🔁 **Seamless migration** from `@react-native-community/geolocation`
- 🧩 **TypeScript-first** developer experience
- 🔄 **100% API compatibility** (via `/compat`) — can be used as a **drop-in replacement**

Whether you're upgrading an existing app or building a new one using the latest React Native architecture, **React Native Nitro Geolocation** gives you modern tools with proven performance.


## Next Steps

- [Quick Start Guide](/guide/quick-start) — Get up and running in minutes
- [Modern API Reference](/guide/modern-api) — Explore functions and hooks
- [Legacy API Reference](/guide/legacy-api) — Compatibility documentation
- [Why Nitro Module?](/guide/why-nitro-module) — Architecture deep dive
- [Benchmark Results](/guide/benchmark) — Performance comparison
