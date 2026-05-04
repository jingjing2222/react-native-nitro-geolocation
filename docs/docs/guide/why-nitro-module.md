# Why Nitro Module?

The **Nitro Module** system provides the next generation of native modules for React Native.
Instead of using the bridge-based approach (JSON serialization between JS and native), Nitro Modules communicate directly through **JSI (JavaScript Interface)**.

This enables:

- ⚡ **Direct native calls** — reduced overhead
- 🧠 **Synchronous APIs** for critical paths
- 🔧 **Better integration** with the new Fabric renderer
- 🧩 **Cross-platform consistency** and simpler maintenance

In short, Nitro Geolocation builds on the proven API design of `@react-native-community/geolocation` while leveraging the new React Native architecture, providing a **forward-compatible foundation** with **100% API compatibility**.

## Architecture Comparison

### Origin: Event-based Architecture (`@react-native-community/geolocation`)

```
JavaScript Layer
  ↓ EventEmitter.addListener('geolocationDidChange', callback)
  ↓ (Callback stored in JS only)
React Native Bridge (JSON serialization)
  ↓
Native Layer (Android/iOS)
  ↓ LocationListener receives updates
  ↓ emit('geolocationDidChange', data) → Bridge
  ↓
EventEmitter dispatches to all listeners
  ↓
User callback executed
```

**Key characteristics:**
- Callbacks **not passed** to native — stored in JS EventEmitter
- Native emits generic events through Bridge
- Multiple listeners share one event stream
- Requires JSON serialization on every update

### Modern API: Direct Callback Architecture (`React Native Nitro Geolocation`)

```
JavaScript Layer
  ↓ nitroGeolocation.watchPosition(success, error, options)
  ↓ (Callbacks passed directly to native via JSI)
JSI Layer (No Bridge!)
  ↓
Native Layer (Kotlin/Swift)
  ↓ LocationListener receives updates
  ↓ callback.success(position) → JSI direct call
  ↓
User callback executed immediately
```

**Key characteristics:**
- Callbacks **passed directly** to native as JSI function references
- Native calls JS functions directly (no Bridge)
- Each watch has its own callback (no shared event stream)
- Minimal serialization (C++ structs → JS objects)

## Hook Layer

React Native Nitro Geolocation now provides a React-friendly layer on top of the JSI architecture:

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

**Benefits of Hook Layer**:
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

1. **TypeScript spec** (`NitroGeolocation.nitro.ts`) defines the interface
2. **Nitrogen generates C++ code** that bridges Kotlin/Swift ↔ JSI
3. **HybridObject** in native code implements the spec
4. **JSI** holds references to JS functions and calls them directly

**Result:** When `watchPosition(callback)` is called, the `callback` function becomes a JSI function reference in native code, callable without the Bridge.

## When to Use Each Approach

### Use Event-based if:
- Supporting React Native < 0.68
- Team unfamiliar with JSI/New Architecture
- Stability over performance

### Use Nitro (Direct Callback) if:
- Performance-critical (real-time tracking, animations)
- Using React Native New Architecture
- Need type safety at compile-time
- Building for the future

## Summary

`React Native Nitro Geolocation` transforms the geolocation API at multiple levels:

1. **Low-level**: Bridge-based events → JSI direct callbacks (Nitro Modules)
2. **High-level**: Imperative callbacks → Declarative hooks (Modern API)

This provides:
- **Performance**: Native-level speed via JSI
- **Developer Experience**: React-friendly hooks with TanStack Query patterns
- **Flexibility**: Choose Modern API (hooks) or Compat API (callbacks)
- **Compatibility**: 100% backward compatible via `/compat`
