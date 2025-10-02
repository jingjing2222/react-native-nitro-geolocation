# React Native Nitro Geolocation

⚡🚀 **Blazing-fast geolocation for React Native powered by Nitro Modules**

A high-performance React Native geolocation library built with [Nitro Modules](https://nitro.margelo.com/), providing zero-bridge overhead and full TypeScript support. This library is a Nitro Module port of the popular [`@react-native-community/geolocation`](https://github.com/michalchudziak/react-native-geolocation) library.

## Features

- 🚀 **Zero Bridge Overhead**: Direct native module access using Nitro Modules
- 📱 **Cross-Platform**: iOS and Android support
- 🔒 **Type Safe**: Full TypeScript definitions
- 🎯 **API Compatible**: Drop-in replacement for `@react-native-community/geolocation`
- ⚡ **High Performance**: 5-15x faster than traditional bridge-based modules
- 🔄 **Background Location**: Support for background location updates
- 📍 **Modern APIs**: Uses latest location APIs (Play Services on Android)

## Requirements

- React Native >= 0.70.0
- iOS >= 11.0
- Android API >= 21

## Installation

```bash
npm install react-native-nitro-geolocation
# or
yarn add react-native-nitro-geolocation
```

### iOS Setup

Add the following keys to your `Info.plist`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app needs access to your location to provide location-based features.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app needs access to your location to provide location-based features.</string>
```

For background location (optional):
```xml
<key>NSLocationAlwaysUsageDescription</key>
<string>This app needs access to your location in the background.</string>
```

### Android Setup

Add the following permissions to your `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<!-- Optional: for coarse location -->
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

## Usage

### Basic Usage

```typescript
import Geolocation from 'react-native-nitro-geolocation';

// Get current position
Geolocation.getCurrentPosition(
  (position) => {
    console.log('Current position:', position);
    console.log('Latitude:', position.coords.latitude);
    console.log('Longitude:', position.coords.longitude);
  },
  (error) => {
    console.error('Location error:', error);
  },
  {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 10000
  }
);
```

### Watch Position Changes

```typescript
const watchId = Geolocation.watchPosition(
  (position) => {
    console.log('Position update:', position);
  },
  (error) => {
    console.error('Watch error:', error);
  },
  {
    enableHighAccuracy: true,
    distanceFilter: 10, // Update every 10 meters
    interval: 5000, // Android: Update every 5 seconds
  }
);

// Stop watching
Geolocation.clearWatch(watchId);
```

### Request Permissions

```typescript
Geolocation.requestAuthorization(
  () => {
    console.log('Permission granted');
  },
  (error) => {
    console.error('Permission denied:', error);
  }
);
```

### Configuration

```typescript
Geolocation.setRNConfiguration({
  skipPermissionRequests: false,
  authorizationLevel: 'whenInUse', // iOS: 'always' | 'whenInUse' | 'auto'
  enableBackgroundLocationUpdates: false, // iOS only
  locationProvider: 'auto' // Android: 'playServices' | 'android' | 'auto'
});
```

## API Reference

### Methods

#### `getCurrentPosition(success, error?, options?)`

Gets the current location of the device.

**Parameters:**
- `success: (position: GeolocationResponse) => void` - Success callback
- `error?: (error: GeolocationError) => void` - Error callback (optional)
- `options?: GeolocationOptions` - Location options (optional)

#### `watchPosition(success, error?, options?)`

Starts watching the device's position. Returns a watch ID.

**Parameters:**
- `success: (position: GeolocationResponse) => void` - Success callback
- `error?: (error: GeolocationError) => void` - Error callback (optional)
- `options?: GeolocationOptions` - Location options (optional)

**Returns:** `number` - Watch ID

#### `clearWatch(watchID)`

Stops watching the position for the given watch ID.

**Parameters:**
- `watchID: number` - The ID returned by `watchPosition`

#### `requestAuthorization(success?, error?)`

Requests location permission from the user.

**Parameters:**
- `success?: () => void` - Success callback (optional)
- `error?: (error: GeolocationError) => void` - Error callback (optional)

#### `setRNConfiguration(config)`

Sets global configuration for the geolocation module.

**Parameters:**
- `config: GeolocationConfiguration` - Configuration object

### Types

#### `GeolocationResponse`

```typescript
interface GeolocationResponse {
  coords: {
    latitude: number;
    longitude: number;
    altitude: number | null;
    accuracy: number;
    altitudeAccuracy: number | null;
    heading: number | null;
    speed: number | null;
  };
  timestamp: number;
}
```

#### `GeolocationOptions`

```typescript
interface GeolocationOptions {
  timeout?: number;                    // Max time to get location (ms)
  maximumAge?: number;                 // Max age of cached location (ms)
  enableHighAccuracy?: boolean;        // Use GPS vs network location
  distanceFilter?: number;             // Min distance for updates (meters)
  useSignificantChanges?: boolean;     // iOS: Use significant location changes
  interval?: number;                   // Android: Update interval (ms)
  fastestInterval?: number;            // Android: Fastest update interval (ms)
}
```

#### `GeolocationConfiguration`

```typescript
interface GeolocationConfiguration {
  skipPermissionRequests: boolean;
  authorizationLevel?: 'always' | 'whenInUse' | 'auto';     // iOS only
  locationProvider?: 'playServices' | 'android' | 'auto';   // Android only
  enableBackgroundLocationUpdates?: boolean;                // iOS only
}
```

#### `GeolocationError`

```typescript
interface GeolocationError {
  code: number;
  message: string;
  PERMISSION_DENIED: number;
  POSITION_UNAVAILABLE: number;
  TIMEOUT: number;
}
```

## Migration from @react-native-community/geolocation

This library is designed as a drop-in replacement. Simply replace your import:

```typescript
// Before
import Geolocation from '@react-native-community/geolocation';

// After
import Geolocation from 'react-native-nitro-geolocation';
```

## Performance

Thanks to Nitro Modules, this library provides:

- **5-15x faster** method calls compared to bridge-based libraries
- **Zero serialization overhead** for method calls
- **Synchronous property access** where applicable
- **Direct native callbacks** without event emitter overhead

## Troubleshooting

### Location Permission Issues

Make sure you've added the required permissions to your platform configuration files and requested them at runtime using `requestAuthorization()`.

### Android Play Services

If you encounter issues with Google Play Services on Android, try setting the location provider:

```typescript
Geolocation.setRNConfiguration({
  skipPermissionRequests: false,
  locationProvider: 'android' // Falls back to Android location API
});
```

### Background Location (iOS)

For background location updates on iOS:

1. Add `NSLocationAlwaysUsageDescription` to Info.plist
2. Enable background location updates:

```typescript
Geolocation.setRNConfiguration({
  skipPermissionRequests: false,
  authorizationLevel: 'always',
  enableBackgroundLocationUpdates: true
});
```

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository.

## License

MIT

## Credits

This library is a Nitro Module port of [`@react-native-community/geolocation`](https://github.com/michalchudziak/react-native-geolocation) by Michal Chudziak. Special thanks to Marc Rousavy for creating [Nitro Modules](https://nitro.margelo.com/).