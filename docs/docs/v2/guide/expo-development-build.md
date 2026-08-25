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
npx expo install react-native-nitro-modules react-native-nitro-geolocation@rc
```

Then generate or update the native projects:

```bash
npx expo prebuild
```

Install iOS pods after native project generation:

```bash
cd ios && pod install
```

## Optional config plugin

The package includes an opt-in Expo config plugin. Installing the package does
not activate it, and there is no `postinstall` mutation. Add it explicitly to
the app config when you want Expo prebuild or EAS Build to generate foreground
permission entries:

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-nitro-geolocation",
        {
          "locationWhenInUsePermission": "Allow $(PRODUCT_NAME) to show nearby deliveries."
        }
      ]
    ]
  }
}
```

The plugin preserves an existing non-empty iOS permission message when an
option is omitted. Otherwise it uses a generic default. It adds Android coarse
and fine location permissions idempotently.

Background configuration is a separate opt-in:

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-nitro-geolocation",
        {
          "enableBackgroundLocation": true,
          "locationWhenInUsePermission": "Allow $(PRODUCT_NAME) to show nearby deliveries.",
          "locationAlwaysAndWhenInUsePermission": "Allow $(PRODUCT_NAME) to continue an active delivery."
        }
      ]
    ]
  }
}
```

This also adds the iOS `location` background mode and the Android background,
foreground-service, foreground-service-location, and notification permission
declarations. Your app must still request runtime permissions from a user
action and explain why background access is needed. Run `npx expo prebuild`
and rebuild the native app after changing plugin options.

When changing `enableBackgroundLocation` from `true` to `false`, regenerate the
native projects with `npx expo prebuild --clean` before rebuilding. The plugin
does not remove existing background declarations from an already-generated
project because it cannot distinguish its previous output from app-owned native
configuration. If a clean prebuild is not possible, remove the Android
background/service/notification declarations, the iOS Always usage description,
and the iOS `location` background mode manually when they are no longer needed.

## Manual native permissions

If you do not enable the config plugin, add the same native permission
declarations as a bare React Native app.

iOS `Info.plist`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app requires access to your location while it's in use.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app requires access to your location at all times.</string>
```

For background tracking, also enable the `location` background mode in
`UIBackgroundModes`; see [iOS background setup](/background/setup-ios).

Android `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

Optional background permission:

```xml
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
```

Full background tracking uses a foreground service on Android. Add the full
permission set from [Android background setup](/background/setup-android) when
using `react-native-nitro-geolocation/background`, including Android 13+
`POST_NOTIFICATIONS` for the tracking notification.

## Supported Positioning

Use this package when you want Nitro/New Architecture native geolocation in an
Expo development build or custom native build.

Use `expo-location` when you need Expo Go, managed workflow setup without native
rebuilds, Expo background tasks, or Expo geofencing.
