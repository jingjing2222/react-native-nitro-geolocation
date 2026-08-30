# react-native-nitro-geolocation

[![NPM](https://img.shields.io/npm/v/react-native-nitro-geolocation)](https://www.npmjs.com/package/react-native-nitro-geolocation)

**Nitro-powered geolocation for React Native apps**

> **2.0 release candidate:** this README documents RC contracts. Install with
> `react-native-nitro-geolocation@rc` and use the
> [versioned 2.0 docs](https://react-native-nitro-geolocation.pages.dev/v2/).
> For stable 1.x, use the
> [unversioned documentation](https://react-native-nitro-geolocation.pages.dev/).

A native iOS/Android geolocation module for React Native 0.75+ apps using the
New Architecture and Nitro Modules. Start by replacing
[`@react-native-community/geolocation`](https://github.com/michalchudziak/react-native-geolocation)
with `/compat`, then move to the typed API when you are ready.
The current release line adds foreground web support through both the package
import and `/compat`, plus a native Background Location API for tracking, geofencing,
storage recovery, Headless JS, and HTTP sync.

- 🎯 **Simple functional API** — Direct function calls, no complex abstractions
- ⚡ **Low-overhead native calls** — Avoids Bridge serialization on supported native paths
- 🔁 **Compat API** — Preserves core callback methods and numeric errors; documented boundaries apply
- 🧹 **Hook-owned cleanup** — `useWatchPosition` removes its component subscription automatically
- 📱 **Explicit platform contracts** across iOS, Android, and web
- 🛠️ **DevTools Plugin** — Mock locations with interactive map (Rozenite)

![react-native-nitro-geolocation](https://raw.githubusercontent.com/jingjing2222/react-native-nitro-geolocation/main/demo.gif)

---

## 📘 Documentation

2.0 RC documentation:
👉 [https://react-native-nitro-geolocation.pages.dev/v2/](https://react-native-nitro-geolocation.pages.dev/v2/)

---

## When should I use this?

| Use case | Recommendation |
|---|---|
| Bare React Native 0.75+ app with New Architecture/Nitro enabled | Use Nitro Geolocation |
| Migrating from `@react-native-community/geolocation` | Start with `/compat` |
| New Architecture / Nitro-based app | Recommended |
| Expo development build or custom native build | Supported with native setup |
| Expo managed app without native rebuild | Use `expo-location` |
| Web support required | Use the package import or `/compat` callback API |
| Full background tracking / geofencing | Use `react-native-nitro-geolocation/background` |

Web support is available for the package import and the `/compat`
subpath. Browser builds resolve both entries to implementations backed by
`navigator.geolocation` and do not load Nitro native bindings. Background
location remains native-only.

---

## 🧭 Introduction

React Native Nitro Geolocation provides **three public API surfaces** to fit
your needs:

### 1. API (Recommended)

**Simple functional API** with direct calls and a single hook for tracking:

```tsx
import {
  setConfiguration,
  requestPermission,
  getCurrentPosition,
} from "react-native-nitro-geolocation";

setConfiguration({
  authorizationLevel: "whenInUse",
  locationProvider: "auto",
});

const status = await requestPermission();

if (status === "granted") {
  const position = await getCurrentPosition({
    accuracy: { android: "high", ios: "best" },
    timeout: 15_000,
  });
  console.log(position.metadata);
  // { source, age, quality, staleReason? }
}
```

Foreground responses include optional observational metadata for the
delivery source, age, horizontal-accuracy quality band, and stale reason. This
metadata never causes the library to reject a stale or low-accuracy position;
applications can apply their own policy. The `/compat` response shape is
unchanged.

See the [API guide](https://react-native-nitro-geolocation.pages.dev/v2/guide/api)
for watches, geocoding, heading, cached reads, Android settings, and iOS
accuracy authorization.

### 2. Compat API (Compatibility)

Migration-friendly compatibility with the core native
`@react-native-community/geolocation` callback surface. Review the documented
defaults, ignored options, and global-polyfill boundary before shipping:

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

The `/compat` subpath covers the core native community API, including
`setRNConfiguration`, `requestAuthorization`, `getCurrentPosition`,
`watchPosition`, `clearWatch`, and `stopObserving`. It also has a browser entry
for callback-style foreground geolocation. See the
[Compat API guide](https://react-native-nitro-geolocation.pages.dev/v2/guide/compat-api)
for the full compatibility matrix and option notes.

### 3. Background API

Native background tracking, geofencing, activity events, Android Headless JS,
HTTP sync, stored event recovery, and silent-delivery diagnosis should use the
explicit background subpath.

Background location is native-only. Browser builds expose unsupported stubs so
web bundles can still import shared code safely. Start with the
[Background Location guide](https://react-native-nitro-geolocation.pages.dev/v2/background/overview)
for permissions, start/stop, geofencing, storage recovery, and native sync.
Use `diagnoseBackgroundLocation()` from the same subpath to turn the raw
background status into actionable issues when delivery is silent.

---

## ⚡ Quick Start

### 1. Installation

```bash
# Install Nitro core and Geolocation module
yarn add react-native-nitro-modules react-native-nitro-geolocation@rc

# or using npm
npm install react-native-nitro-modules react-native-nitro-geolocation@rc
```

This quick start is foreground-only. Add one product-specific iOS When In Use
description:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Show your location on the nearby places map.</string>
```

Add Android foreground location declarations:

```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

Do not add iOS Always/background mode or Android background/service permissions
for a foreground-only feature. Use the
[Background Location setup](https://react-native-nitro-geolocation.pages.dev/v2/background/overview)
only when the product must track while the app is not active.

Install iOS pods and rebuild the native app:

```bash
cd ios
bundle exec pod install
cd ..
yarn ios
```

Use `pod install` directly when your app does not check in a `Gemfile`.
React Native 0.87.x can use the experimental precompiled Swift Package Manager
path with Nitro Modules 0.37.1 and an app configuration helper. CocoaPods
remains the recommended production path; follow the
[Swift Package Manager guide](https://react-native-nitro-geolocation.pages.dev/v2/guide/swift-package-manager)
exactly before converting an RN 0.87 app.

For Android, rebuild with:

```bash
yarn android
```

After adding permissions and generating the native projects, inspect the
installation without changing files:

```bash
yarn nitro-geolocation doctor
```

Use `nitro-geolocation doctor --project apps/mobile --json` for monorepos or
CI. Missing generated native folders are warnings; rerun it after native
generation to verify permissions and usage descriptions.

Expo development builds can opt into native permission generation by listing
`react-native-nitro-geolocation` in the app config `plugins` array. Installation
alone does not mutate native files. See the
[Expo development build guide](https://react-native-nitro-geolocation.pages.dev/v2/guide/expo-development-build)
for foreground and explicit background options.

Before release, review the project's
[privacy statement](https://github.com/jingjing2222/react-native-nitro-geolocation/blob/main/PRIVACY.md)
and [privacy and compliance guide](https://react-native-nitro-geolocation.pages.dev/v2/guide/privacy-compliance)
for runtime data flows, permission disclosures, dependency inventory, SBOM, and
scanner guidance.

Released npm builds try to use the matching GitHub Release prebuilts first:
Android downloads the release AAR and reuses its native `.so` files, while iOS
downloads the release XCFramework. If the prebuilt asset is unavailable, the
native source build is used automatically. Android prebuilts are used only when
the app's React Native and Nitro Modules major/minor versions match the release
asset build. To force source builds, set `NITRO_GEOLOCATION_USE_PREBUILT=0`.

---

For a copyable screen that renders coordinates and handles denied/timeout
states, continue to [Install and get a location](https://react-native-nitro-geolocation.pages.dev/v2/guide/quick-start).

---

### 2. DevTools Plugin

Use the Rozenite DevTools plugin to mock locations during development with an
interactive map. It works with the package import.

![DevTools Plugin Demo](https://raw.githubusercontent.com/jingjing2222/react-native-nitro-geolocation/main/devtools.gif)

```bash
yarn add @react-native-nitro-geolocation/rozenite-plugin
```

```tsx
import {
  createPosition,
  useGeolocationDevTools,
} from "@react-native-nitro-geolocation/rozenite-plugin";

function App() {
  useGeolocationDevTools({
    initialPosition: createPosition("Seoul, South Korea"),
  });

  return <RootNavigator />;
}
```

The plugin requires Rozenite DevTools in your app. See the
[DevTools Plugin guide](https://react-native-nitro-geolocation.pages.dev/v2/guide/devtools)
for setup, presets, troubleshooting, and the demo.

---

### 5. Continue In The Docs

Use the docs site for the detailed flows:

- [Quick Start](https://react-native-nitro-geolocation.pages.dev/v2/guide/quick-start) - install with minimum foreground permissions and render coordinates.
- [Upgrade from 1.x](https://react-native-nitro-geolocation.pages.dev/v2/guide/upgrade-from-v1) - migrate all seven breaking contracts with rollback gates.
- [Release Readiness](https://react-native-nitro-geolocation.pages.dev/v2/guide/release-readiness) - RC policy, tested reference stack, known limits, and ship checklist.
- [API](https://react-native-nitro-geolocation.pages.dev/v2/guide/api) - accuracy presets, watches, Android settings, cached reads, geocoding, heading, and iOS accuracy authorization.
- [Compat API](https://react-native-nitro-geolocation.pages.dev/v2/guide/compat-api) - callback compatibility and documented boundaries.
- [Background Location](https://react-native-nitro-geolocation.pages.dev/v2/background/overview) - native background setup, platform limits, tracking, recovery, and diagnosis.
- [Troubleshooting](https://react-native-nitro-geolocation.pages.dev/v2/guide/troubleshooting) - collect readiness evidence and open a useful support report.

## 📖 Learn More

- [Choose your path](https://react-native-nitro-geolocation.pages.dev/v2/guide/)
- [Community Migration](https://react-native-nitro-geolocation.pages.dev/v2/guide/community-migration)
- [Service Migration](https://react-native-nitro-geolocation.pages.dev/v2/guide/service-migration)
- [Expo Development Build Guide](https://react-native-nitro-geolocation.pages.dev/v2/guide/expo-development-build)
- [DevTools Plugin Guide](https://react-native-nitro-geolocation.pages.dev/v2/guide/devtools)
- [Privacy and Compliance](https://react-native-nitro-geolocation.pages.dev/v2/guide/privacy-compliance)

---

## License

MIT License.
