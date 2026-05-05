---
title: Expo Development Builds
---

# Expo Development Builds

`react-native-nitro-geolocation` requires native Nitro bindings. It does not run
inside Expo Go because Expo Go cannot load arbitrary native modules that are not
already bundled into the client.

Use this package in Expo apps only when the app has a custom native build:

- Expo prebuild
- Expo development build
- EAS build with native project generation
- Any custom native iOS/Android build that can install pods and Gradle modules

Managed Expo apps that cannot rebuild native code should use `expo-location`.

## Installation

Install the native dependencies:

```bash
npx expo install react-native-nitro-modules react-native-nitro-geolocation
```

Then generate or update the native projects:

```bash
npx expo prebuild
```

Install iOS pods after native project generation:

```bash
cd ios && pod install
```

## Native Permissions

Add the same native permission declarations as a bare React Native app.

iOS `Info.plist`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app requires access to your location while it's in use.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app requires access to your location at all times.</string>
```

Android `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

Optional background permission:

```xml
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
```

## Supported Positioning

Use this package when you want Nitro/New Architecture native geolocation in an
Expo development build or custom native build.

Use `expo-location` when you need Expo Go, managed workflow setup without native
rebuilds, Expo background tasks, Expo geofencing, or Expo config-plugin-driven
permission setup.

