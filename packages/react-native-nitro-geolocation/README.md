# react-native-nitro-geolocation

[![NPM](https://img.shields.io/npm/v/react-native-nitro-geolocation)](https://www.npmjs.com/package/react-native-nitro-geolocation)

**Nitro-powered geolocation for modern React Native apps**

A native iOS/Android geolocation module for React Native 0.75+ and New
Architecture apps. Start by replacing
[`@react-native-community/geolocation`](https://github.com/michalchudziak/react-native-geolocation)
with `/compat`, then move to a typed Modern API when you are ready.

- 🎯 **Simple functional API** — Direct function calls, no complex abstractions
- ⚡ **JSI-powered performance** — Direct native calls without Bridge overhead
- 🔁 **Compat API** — Drop-in compatible with the core native community API
- 🧹 **Automatic cleanup** — No manual subscription management
- 📱 **Consistent behavior** across iOS and Android
- 🛠️ **DevTools Plugin** — Mock locations with interactive map (Rozenite)

![react-native-nitro-geolocation](https://raw.githubusercontent.com/jingjing2222/react-native-nitro-geolocation/main/demo.gif)

---

## 📘 Documentation

Full documentation available at:
👉 [https://react-native-nitro-geolocation.pages.dev](https://react-native-nitro-geolocation.pages.dev)

---

## When should I use this?

| Use case | Recommendation |
|---|---|
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

---

## 🧭 Introduction

React Native Nitro Geolocation provides **two APIs** to fit your needs:

### 1. Modern API (Recommended)

**Simple functional API** with direct calls and a single hook for tracking:

```tsx
import {
  setConfiguration,
  requestPermission,
  requestLocationSettings,
  getLocationAvailability,
  getCurrentPosition,
  getLastKnownPosition,
  geocode,
  reverseGeocode,
  getHeading,
  watchHeading,
  unwatch,
  getAccuracyAuthorization,
  requestTemporaryFullAccuracy,
  useWatchPosition,
} from "react-native-nitro-geolocation";

// Configure once at app startup
setConfiguration({
  authorizationLevel: "whenInUse",
  locationProvider: "auto",
});

// Request permission
const status = await requestPermission();

// Android, v1.2+: ask the user to enable settings required for accurate location
await requestLocationSettings({ accuracy: { android: "high" } });

// v1.2+: check whether the platform can currently provide locations
const availability = await getLocationAvailability();

// Get current location
const position = await getCurrentPosition({
  accuracy: { android: "high", ios: "best" },
  granularity: "permission",
  waitForAccurateLocation: true,
});

// v1.2+: read cached location explicitly without starting a fresh request
const cached = await getLastKnownPosition({
  maximumAge: 60_000,
  accuracy: { android: "balanced", ios: "hundredMeters" },
});

// v1.2+: convert between addresses and coordinates with native geocoders
const locations = await geocode("City Hall, Seoul, South Korea");
const addresses = await reverseGeocode({
  latitude: 37.5665,
  longitude: 126.978,
});

// v1.2+: inspect precise/reduced accuracy authorization
const accuracyAuthorization = await getAccuracyAuthorization();
if (accuracyAuthorization === "reduced") {
  await requestTemporaryFullAccuracy("TurnByTurnNavigation");
}

// v1.2+: read and watch compass heading
const heading = await getHeading();
const headingToken = watchHeading((nextHeading) => {
  console.log(nextHeading.magneticHeading);
});
unwatch(headingToken);

// Continuous tracking with hook
function LocationTracker() {
  const { position, error, isWatching } = useWatchPosition({
    enabled: true,
    accuracy: { android: "high", ios: "bestForNavigation" },
    distanceFilter: 10,
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

### 2. Compat API (Compatibility)

Drop-in compatible with the core native
`@react-native-community/geolocation` API:

```tsx
import Geolocation from "react-native-nitro-geolocation/compat";

Geolocation.getCurrentPosition(
  (position) => console.log(position),
  (error) => console.error(error),
  { enableHighAccuracy: true }
);

const watchId = Geolocation.watchPosition((position) => console.log(position));
Geolocation.clearWatch(watchId);
```

#### Compat API coverage

| Community API | Nitro `/compat` | Notes |
|---|---:|---|
| `setRNConfiguration` | Supported | Android `auto` currently maps to the platform provider; set `playServices` explicitly for fused location. |
| `requestAuthorization` | Supported | iOS authorization follows configured `Info.plist` keys and `authorizationLevel`. |
| `getCurrentPosition` | Supported | Keeps the legacy callback and error shape. |
| `watchPosition` | Supported | Returns a numeric watch id. |
| `clearWatch` | Supported | Clears a watch id from `watchPosition`. |
| `stopObserving` | Supported | Preserved for legacy cleanup compatibility. |
| `navigator.geolocation` polyfill | Not supported in `v1.2.x` | Planned for `v1.3`. |
| Web | Not supported in `v1.2.x` | Planned as a `/compat` browser fallback in `v1.3`. |

---

## ⚡ Quick Start

### 1. Installation

```bash
# Install Nitro core and Geolocation module
yarn add react-native-nitro-modules react-native-nitro-geolocation

# or using npm
npm install react-native-nitro-modules react-native-nitro-geolocation
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

### 4. Android Reliability

- Uses Google Play Services fused location when `locationProvider:
  "playServices"` is set.
- Keeps `locationProvider: "auto"` on Android's platform `LocationManager` by
  default. Set `playServices` explicitly when you want fused location behavior.
- Supports native settings resolution through `requestLocationSettings`.
- Supports approximate/coarse location handling through permissions and
  Android `granularity`.
- Supports explicit cached reads through `getLastKnownPosition`.
- Provides structured Modern API errors such as `PLAY_SERVICE_NOT_AVAILABLE`,
  `SETTINGS_NOT_SATISFIED`, and `TIMEOUT`.

---

### 5. Expo Development Builds

This package requires native Nitro bindings, so it is not an Expo Go module.
Use Expo prebuild, a development build, or another custom native build flow,
then apply the same iOS and Android native permission setup shown above.

Managed Expo apps that cannot rebuild native code should use `expo-location`.
See the [Expo development build guide](https://react-native-nitro-geolocation.pages.dev/guide/expo-development-build)
for the supported setup path.

---

### 6. Development Tools (Optional)

#### DevTools Plugin (Rozenite)

> **Prerequisites**: Requires [Rozenite DevTools](https://github.com/rozenite/rozenite) to be installed.
>
> **API Compatibility**: Only works with the Modern API. Does not support the Compat API (`/compat`).

Mock geolocation data during development with an interactive map interface:

![DevTools Plugin](https://raw.githubusercontent.com/jingjing2222/react-native-nitro-geolocation/main/devtools.gif)

```bash
npm install @react-native-nitro-geolocation/rozenite-plugin
# or
yarn add @react-native-nitro-geolocation/rozenite-plugin
```

**Setup**:

```tsx
import {
  useGeolocationDevTools,
  createPosition,
} from "@react-native-nitro-geolocation/rozenite-plugin";

function App() {
  // Enable location mocking in development
  useGeolocationDevTools({
    initialPosition: createPosition("Seoul, South Korea"),
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

### 7. Usage

#### Modern API (Recommended)

```tsx
// Get current location
const position = await getCurrentPosition({
  accuracy: { android: "high", ios: "best" },
});

// Real-time tracking with hook
const { position, error } = useWatchPosition({
  enabled: true,
  accuracy: { android: "balanced", ios: "nearestTenMeters" },
  distanceFilter: 10
});
```

Accuracy presets are available since `v1.2`.

`getLastKnownPosition(options?)`, `getLocationAvailability()`, `getHeading()`,
`watchHeading()`, `geocode(address)`, `reverseGeocode(coords)`, selected
Android request options (`granularity`, `waitForAccurateLocation`,
`maxUpdateAge`, `maxUpdateDelay`, and `maxUpdates`), iOS tuning options
(`activityType`, `pausesLocationUpdatesAutomatically`, and
`showsBackgroundLocationIndicator`), `getAccuracyAuthorization()`, and
`requestTemporaryFullAccuracy(purposeKey)` are available since `v1.2`.

`enableHighAccuracy` is deprecated in the Modern API and remains supported only
for v1 compatibility. Prefer `accuracy`; when `accuracy.android` or
`accuracy.ios` is provided for the current platform, that explicit preset takes
precedence over the boolean. `enableHighAccuracy` is expected to be removed from
the Modern API in v2.

The `/compat` API keeps `enableHighAccuracy` for drop-in compatibility with
`@react-native-community/geolocation`.

#### Compat API (Compatibility)

```tsx
import Geolocation from "react-native-nitro-geolocation/compat";

Geolocation.getCurrentPosition((pos) => console.log(pos));
const watchId = Geolocation.watchPosition((pos) => console.log(pos));
Geolocation.clearWatch(watchId);
```

---

---

## 🔄 Migration from `@react-native-community/geolocation`

The safest migration is two-step: switch imports to `/compat` first, verify
the app, then move call sites to the Modern API where it improves ownership,
permission timing, cache behavior, or Android settings handling.

For Modern API migration, install the Agent Skills-compatible migration
playbook from this repository. It is migration assistance for coding agents, not
a fully automatic migration. The skill first runs a package-manager-aware
compat bootstrap script that installs the Nitro packages, rewrites legacy import
sources to `/compat`, and removes `@react-native-community/geolocation`. After
that safe mechanical step, it guides the agent to refactor compat call sites to
Modern API best practices using explicit criteria for permission timing, React
lifecycle ownership, watch cleanup, cache-vs-fresh location reads, accuracy, and
Android provider/settings handling.

With the Vercel Labs `skills` CLI:

```bash
npx skills add jingjing2222/react-native-nitro-geolocation --skill react-native-nitro-geolocation-modern-migration
```

The skill source is
[`skills/react-native-nitro-geolocation-modern-migration/SKILL.md`](https://github.com/jingjing2222/react-native-nitro-geolocation/tree/main/skills/react-native-nitro-geolocation-modern-migration).
The bundled bootstrap script is
[`skills/react-native-nitro-geolocation-modern-migration/scripts/migrate-to-compat.mjs`](https://github.com/jingjing2222/react-native-nitro-geolocation/tree/main/skills/react-native-nitro-geolocation-modern-migration/scripts/migrate-to-compat.mjs).

For a drop-in compatibility migration, change the import to use `/compat`:

```diff
- import Geolocation from '@react-native-community/geolocation';
+ import Geolocation from 'react-native-nitro-geolocation/compat';
```

Then migrate individual call sites to the Modern API:

```diff
- Geolocation.getCurrentPosition(onSuccess, onError, {
-   enableHighAccuracy: true,
-   timeout: 15000,
- });
+ const position = await getCurrentPosition({
+   accuracy: { android: "high", ios: "best" },
+   timeout: 15000,
+ });
```

See the [migration demo](https://react-native-nitro-geolocation.pages.dev/guide/migration-demo)
for the full community import → `/compat` → Modern API path.

---

## Benchmark scope

The benchmark measures cached `getCurrentPosition` reads over 1000 iterations ×
5 runs on an iPhone 14 Pro with React Native 0.81.4. It measures the
JS-to-native path for cached locations, not cold GPS acquisition, permission
dialogs, provider availability, or OS throttling.

For cached location reads, Nitro removes Bridge overhead. This does not make GPS
acquisition itself 22x faster; it makes cached reads and the JS-to-native call
path cheaper.

---

## 📖 Learn More

- [Introduction](https://react-native-nitro-geolocation.pages.dev/guide/)
- [Quick Start Guide](https://react-native-nitro-geolocation.pages.dev/guide/quick-start)
- [Modern API Reference](https://react-native-nitro-geolocation.pages.dev/guide/modern-api)
- [Compat API Reference](https://react-native-nitro-geolocation.pages.dev/guide/compat-api)
- [Migration Demo](https://react-native-nitro-geolocation.pages.dev/guide/migration-demo)
- [Expo Development Build Guide](https://react-native-nitro-geolocation.pages.dev/guide/expo-development-build)
- [DevTools Plugin Guide](https://react-native-nitro-geolocation.pages.dev/guide/devtools)
- [Why Nitro Module?](https://react-native-nitro-geolocation.pages.dev/guide/why-nitro-module)
- [Benchmark Results](https://react-native-nitro-geolocation.pages.dev/guide/benchmark)

---

## License

MIT License.
