# Quick Start

This guide walks you through installing and setting up **React Native Nitro Geolocation** in your React Native project.

## 1. Installation

Before installing the module, make sure your app uses React Native 0.75+ with
the New Architecture and Nitro Modules enabled.

```bash
# Install Nitro core and Geolocation module
yarn add react-native-nitro-modules react-native-nitro-geolocation

# or using npm
npm install react-native-nitro-modules react-native-nitro-geolocation
```

After installation, rebuild your native app to ensure the new module is linked.

```bash
cd ios && pod install
```

This package requires native Nitro bindings. Expo Go is not supported. For Expo
apps, use prebuild, a development build, or another custom native build flow;
see the [Expo development build guide](/guide/expo-development-build).


## 2. iOS Setup

### Permissions

Add the following keys to your **Info.plist**:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app requires access to your location while it's in use.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app requires access to your location at all times.</string>
```

For background tracking, also enable the `location` background mode in
`UIBackgroundModes`; see [iOS background setup](/background/setup-ios).


## 3. Android Setup

Add the following permissions to your **android/app/src/main/AndroidManifest.xml**:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

Optional (for background access):

```xml
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
```

Full background tracking uses a foreground service on Android. Add the full
permission set from [Android background setup](/background/setup-android) when
using `react-native-nitro-geolocation/background`, including Android 13+
`POST_NOTIFICATIONS` for the tracking notification.

## 4. Get Your First Location

Configure once at app startup. Ask for permission from a user action, then read
one position.

```tsx
import {
  getCurrentPosition,
  requestPermission,
  setConfiguration
} from 'react-native-nitro-geolocation';

setConfiguration({
  authorizationLevel: 'whenInUse',
  locationProvider: 'auto'
});

async function handleUseMyLocation() {
  const status = await requestPermission();

  if (status === 'granted') {
    const position = await getCurrentPosition({
      accuracy: { android: 'high', ios: 'best' },
      timeout: 15000
    });
  }
}
```

## 5. Android Accuracy Helpers (Optional)

If Android needs a settings prompt or an explicit cached read, configure the
provider in your startup `setConfiguration()` call and add the settings helpers
from the [Modern API reference](/guide/modern-api).

```tsx
import {
  getLastKnownPosition,
  requestLocationSettings
} from 'react-native-nitro-geolocation';

await requestLocationSettings({
  accuracy: { android: 'high' }
});

const cached = await getLastKnownPosition({
  maximumAge: 60_000,
  accuracy: { android: 'balanced', ios: 'hundredMeters' }
});
```


## Next Steps

- [Modern API Reference](/guide/modern-api) — Complete documentation
- [Compat API Reference](/guide/compat-api) — Compatibility methods
- [Background Location](/background/overview) — Native background tracking, geofencing, and storage recovery
- [Migration Guides](/guide/migration-assistance) — Move from community/service geolocation packages
- [Expo Development Builds](/guide/expo-development-build) — Use the package in Expo custom native builds
- [DevTools Plugin Guide](/guide/devtools) — Mock locations in development
- [Why Nitro Module?](/guide/why-nitro-module) — Architecture deep dive
- [Benchmark Results](/guide/benchmark) — Performance comparison
