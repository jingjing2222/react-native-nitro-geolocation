# Quick Start

This guide walks you through installing and setting up **Nitro Geolocation** in your React Native project.


## 1. Installation

Before installing the module, make sure you have the latest React Native environment with **TurboModules** enabled.

~~~bash
# Install Nitro core and Geolocation module
yarn add react-native-nitro-modules nitro-geolocation

# or using npm
npm install react-native-nitro-modules nitro-geolocation
~~~

After installation, rebuild your native app to ensure the new module is linked.

~~~bash
cd ios && pod install
~~~

## 2. iOS Setup

### Permissions

Add the following keys to your **Info.plist**:

~~~xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app requires access to your location while it’s in use.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app requires access to your location at all times.</string>
~~~

## 3. Android Setup

Add the following permissions to your **android/app/src/main/AndroidManifest.xml**:

~~~xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
~~~

Optional (for background access):

~~~xml
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
~~~

## 4. Usage Example

~~~tsx
import Geolocation from '@react-native-community/geolocation';

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

// Subscribe to updates
const watchId = Geolocation.watchPosition(
  (position) => {
    console.log('Updated position:', position);
  },
  (error) => console.error(error),
);

~~~

## 5. Migrating from `@react-native-community/geolocation`

Nitro Geolocation is 100% API-compatible with `@react-native-community/geolocation`.
You can migrate by simply replacing imports:

~~~diff
- import Geolocation from '@react-native-community/geolocation';
+ import Geolocation from 'react-native-nitro-geolocation';
~~~

or

~~~diff
- import { getCurrentPosition, watchPosition } from '@react-native-community/geolocation';
+ import { getCurrentPosition, watchPosition } from 'react-native-nitro-geolocation';
~~~

Most existing code will work as-is — but you’ll now get:
- Better performance via JSI
- No async bridge overhead
- Improved permission consistency
- TypeScript definitions out of the box
