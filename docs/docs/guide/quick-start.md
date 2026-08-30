---
title: Install and get a location
description: Install the 2.0 RC with foreground-only permissions and render the first coordinates in a React Native app.
---

# Install and get a location

This path ends with a button that renders foreground coordinates on iOS or
Android. It deliberately requests **foreground location only**. Do not add
background permissions unless your product must track while the app is not
active.

## Before you install

Your native app must use React Native 0.75 or newer, New Architecture, and Nitro
Modules. Expo apps need a development/custom native build; Expo Go is not
supported. iOS uses CocoaPods. See [Release readiness](./release-readiness.md)
before adopting the RC in a release branch.

## 1. Install an RC

Use `@rc` to evaluate the latest release candidate:

```bash
yarn add react-native-nitro-modules react-native-nitro-geolocation@rc
```

```bash
npm install react-native-nitro-modules react-native-nitro-geolocation@rc
```

For reproducible testing and release approval, replace the moving tags with the
exact versions from the [tested reference stack](./release-readiness.md#tested-reference-stack).

Released npm builds prefer compatible GitHub Release prebuilts and fall back to
a native source build. Android prebuilts require matching React Native and Nitro
Modules major/minor versions. Set `NITRO_GEOLOCATION_USE_PREBUILT=0` when you
need to verify the source-build path.

## 2. Add minimum foreground permissions

### iOS

Add one product-specific explanation to `ios/<AppName>/Info.plist`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Show your location on the nearby places map.</string>
```

Write the value for the feature the user just chose. Do not copy a vague
template into a store build. `NSLocationAlwaysAndWhenInUseUsageDescription` and
the `location` background mode are not needed for this foreground path.

### Android

Add these to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

Do not add `ACCESS_BACKGROUND_LOCATION`, foreground-service, notification,
activity-recognition, boot, or wake-lock permissions for this foreground path.

## 3. Rebuild the native app

Install iOS pods, then rebuild rather than relying on an existing binary:

```bash
cd ios
bundle exec pod install
cd ..
yarn ios
```

Use `pod install` directly when the app has no `Gemfile`. For Android:

```bash
yarn android
```

React Native 0.87.x can instead use the experimental precompiled SwiftPM path.
It requires Nitro Modules 0.37.1 and an app configuration helper; follow the
[Swift Package Manager guide](./swift-package-manager.md) exactly.

## 4. Check the native setup

Run the read-only doctor after adding permissions and generating native files:

```bash
yarn nitro-geolocation doctor
```

The setup is ready for this guide when dependency, New Architecture, and
foreground-permission checks do not report errors. Warnings about optional
background declarations are expected because this flow does not use them. See
[Install Doctor](./install-doctor.md) for monorepo, CI, and JSON output.

## 5. Render the first coordinates

Configure once at startup. Request permission only after a user action.

```tsx
import { useState } from 'react';
import { Button, Text, View } from 'react-native';
import {
  getCurrentPosition,
  requestPermission,
  setConfiguration,
} from 'react-native-nitro-geolocation';

setConfiguration({
  authorizationLevel: 'whenInUse',
  locationProvider: 'auto',
});

export function FirstLocation() {
  const [message, setMessage] = useState('Location has not been requested.');
  const [loading, setLoading] = useState(false);

  async function handleUseMyLocation() {
    setLoading(true);
    setMessage('Requesting permission…');

    try {
      const status = await requestPermission();

      if (status !== 'granted') {
        setMessage(`Location permission is ${status}.`);
        return;
      }

      setMessage('Finding a location…');
      const position = await getCurrentPosition({
        accuracy: { android: 'high', ios: 'best' },
        timeout: 15_000,
      });

      setMessage(
        `${position.coords.latitude.toFixed(5)}, ` +
          `${position.coords.longitude.toFixed(5)} ` +
          `(±${Math.round(position.coords.accuracy)} m)`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Location failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View>
      <Button
        title={loading ? 'Finding location…' : 'Use my location'}
        disabled={loading}
        onPress={handleUseMyLocation}
      />
      <Text accessibilityLiveRegion="polite">{message}</Text>
    </View>
  );
}
```

## Confirm the outcome

- On success, the screen shows `latitude, longitude (±accuracy m)`.
- `denied` or `restricted` means the app must explain the feature and let the
  user choose whether to review system settings; do not loop permission prompts.
- A timeout means no acceptable fix arrived within 15 seconds. Try outdoors or
  lower the accuracy requirement rather than requesting background permission.
- On Android, a provider/settings error means device location services or the
  requested accuracy is unavailable. Follow [Troubleshooting](./troubleshooting.md).

## Continue only for your use case

- [API reference](./api.md) for readiness, cached reads, watches,
  geocoding, and heading.
- [Community migration](./community-migration.md) if this replaces the community
  callback package.
- [Background Location](../background/overview.md) only when the product must
  track while the app is not active.
