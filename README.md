# react-native-nitro-geolocation

[![NPM](https://img.shields.io/npm/v/react-native-nitro-geolocation)](https://www.npmjs.com/package/react-native-nitro-geolocation)
A **Nitro-powered, JSI-based reimplementation** of
[`@react-native-community/geolocation`](https://github.com/michalchudziak/react-native-geolocation)
for the **React Native New Architecture** — with 100% API compatibility.

![react-native-nitro-geolocation](https://raw.githubusercontent.com/jingjing2222/react-native-nitro-geolocation/main/demo.gif)


---

## 📘 Documentation

Full documentation available at:
👉 [https://react-native-nitro-geolocation.pages.dev](https://react-native-nitro-geolocation.pages.dev)

---

## 🧭 Introduction

The `@react-native-community/geolocation` package has long been the standard way to access device location in React Native apps.

With React Native moving toward **Nitro Modules**, **Fabric**, and **JSI**,
this project — **React Native Nitro Geolocation** — brings the same familiar API to the new architecture.

It provides the **same API surface** with:

- 🚀 Faster performance via direct **JSI bindings**
- 📱 Improved native consistency (Android + iOS)
- 🔁 Seamless migration from `@react-native-community/geolocation`
- 🧩 TypeScript-first developer experience
- 🔄 100% API compatibility (drop-in replacement)

Whether upgrading an existing app or building a new one,
**React Native Nitro Geolocation** keeps the simplicity you know — with modern internals.

## 🏗 Architecture Comparison

### 🧩 Origin: Event-based Architecture (`@react-native-community/geolocation`)

~~~
JavaScript
  ↓ EventEmitter.addListener('geolocationDidChange', callback)
  ↓ (Callback stored in JS)
React Native Bridge (JSON serialization)
  ↓
Native Layer (Android/iOS)
  ↓ LocationListener receives updates
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

### ⚡ Modern: Direct Callback Architecture (`react-native-nitro-geolocation`)

~~~
JavaScript
  ↓ Geolocation.watchPosition(success, error)
  ↓ (Callbacks passed directly to native via JSI)
JSI Layer (No Bridge!)
  ↓
Native Layer (Kotlin/Swift)
  ↓ callback.success(position) → JSI direct call
  ↓
User callback executed immediately
~~~

**Key traits:**
- Callbacks passed as native JSI references
- No Bridge serialization
- Independent callback per watcher
- Native → JS communication in real time

---

## ⚡ Quick Start

### 1. Installation

~~~bash
# Install Nitro core and Geolocation module
yarn add react-native-nitro-modules react-native-nitro-geolocation

# or using npm
npm install react-native-nitro-modules react-native-nitro-geolocation
~~~

After installation, rebuild your native app:

~~~bash
cd ios && pod install
~~~

---

### 2. iOS Setup

Add the following permissions to your **Info.plist**:

~~~xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app requires access to your location while it’s in use.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app requires access to your location at all times.</string>
~~~

---

### 3. Android Setup

Add these permissions to your **AndroidManifest.xml**:

~~~xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
~~~

Optional (for background access):

~~~xml
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
~~~

---

### 4. Usage Example

~~~tsx
import Geolocation from 'react-native-nitro-geolocation';

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

---

## 🧠 API Methods

### Summary
- `setRNConfiguration`
- `requestAuthorization`
- `getCurrentPosition`
- `watchPosition`
- `clearWatch`
- `stopObserving`

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

~~~tsx
import Geolocation from 'react-native-nitro-geolocation';

Geolocation.requestAuthorization(
  () => console.log('Permission granted'),
  (error) => console.error('Permission error:', error),
);

// recommended
import { requestAuthorization } from 'react-native-nitro-geolocation';

requestAuthorization(
  () => console.log('Permission granted'),
  (error) => console.error('Permission error:', error),
);
~~~

---

### `getCurrentPosition()`

Retrieves the current device location once.

~~~tsx
import Geolocation from 'react-native-nitro-geolocation';

Geolocation.getCurrentPosition(
  (position) => console.log(position),
  (error) => console.error(error),
  { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
);

// recommended
import { getCurrentPosition } from 'react-native-nitro-geolocation';

getCurrentPosition(
  (position) => console.log(position),
  (error) => console.error(error),
  { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
);
~~~

---

### `watchPosition()`

Watches location changes and calls the success callback each time.

~~~tsx
import Geolocation from 'react-native-nitro-geolocation';

const id = Geolocation.watchPosition(
  (position) => console.log('Position:', position),
  (error) => console.error(error),
  { interval: 5000, distanceFilter: 10 },
);

// recommended
import { watchPosition } from 'react-native-nitro-geolocation';

const id = watchPosition(
  (position) => console.log('Position:', position),
  (error) => console.error(error),
  { interval: 5000, distanceFilter: 10 },
);

~~~

---

### `clearWatch()`

Stops watching location updates for a given watch ID.

~~~tsx
import Geolocation from 'react-native-nitro-geolocation';
Geolocation.clearWatch(id);

// recommended
import { clearWatch } from 'react-native-nitro-geolocation';
clearWatch(id);
~~~

---

## 📊 Performance Benchmarks

Performance comparison between `react-native-nitro-geolocation` (Nitro) and `@react-native-community/geolocation` (Community).

**Test Environment:**
- Device: iPhone (iOS Simulator)
- React Native: 0.76.x
- Test: 1000 iterations × 5 runs of `getCurrentPosition` with cached location (measuring pure bridge/JSI latency)

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
| **Samples** | 1000 | 1000 | - |

### Why is Nitro faster?

1. **Zero Queue Overhead**: Cached location responses return immediately without any dispatch queue overhead
2. **Direct JSI Calls**: No JSON serialization or async bridge crossing
3. **Optimized Architecture**: Fast path for cached responses, queue-free delegate callbacks

---

## 🧪 Summary

**React Native Nitro Geolocation** transforms the geolocation API
from a bridge-based, event-driven system into a **JSI-powered direct-callback model** —
delivering native-level performance with **zero API changes** for developers.
