# Introduction

The [`@react-native-community/geolocation`](https://github.com/michalchudziak/react-native-geolocation) package has been the standard way to access device location in React Native apps.

With the React Native ecosystem moving toward **TurboModules**, **Fabric**, and **JSI-based architecture**, we saw an opportunity to bring geolocation to the new architecture while improving the developer experience.

This project — **React Native Nitro Geolocation** — is a complete reimplementation designed for the **Nitro Module** system, providing **two APIs** to fit your needs:

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

- **🎯 Declarative**: Use `{ enabled }` prop instead of imperative start/stop
- **🧹 Auto-cleanup**: No need to remember `clearWatch()` in `useEffect` cleanup
- **🔌 Provider pattern**: Configure once at app root, use anywhere
- **🪝 TanStack Query-inspired**: Familiar patterns for data fetching
- **📘 Type-safe**: Full TypeScript support with inference

---

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
