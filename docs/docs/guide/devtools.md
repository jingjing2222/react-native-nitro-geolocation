# DevTools Plugin (Rozenite) - **COMMING SOON**

Mock geolocation data in development with an interactive map interface using the Rozenite DevTools plugin.

## Prerequisites

This plugin requires [Rozenite DevTools](https://github.com/rozenite/rozenite) to be set up in your project. Follow the [Rozenite installation guide](https://rozenite.dev/docs/getting-started) before proceeding.

:::warning API Compatibility
This DevTools plugin only works with the **Modern API** (`react-native-nitro-geolocation`). It does **not** support the Legacy API (`react-native-nitro-geolocation/compat`).
:::

## Installation

```bash
npm install @react-native-nitro-geolocation/rozenite-plugin
# or
yarn add @react-native-nitro-geolocation/rozenite-plugin
```

## Setup

Add the devtools hook to your app entry point:

```tsx
import { useGeolocationDevTools } from '@react-native-nitro-geolocation/rozenite-plugin';

function App() {
  // Enable devtools with default position (Seoul)
  useGeolocationDevTools();

  return <YourApp />;
}
```

### With Initial Position

#### Using City Presets

Choose from 20 pre-configured city locations:

```tsx
import { useGeolocationDevTools, createPosition } from '@react-native-nitro-geolocation/rozenite-plugin';

function App() {
  useGeolocationDevTools({
    initialPosition: createPosition('Dubai, UAE')
  });

  return <YourApp />;
}
```

#### Using Custom Coordinates

Manually define a position with specific coordinates:

```tsx
import { useGeolocationDevTools, type Position } from '@react-native-nitro-geolocation/rozenite-plugin';

const customPosition: Position = {
  coords: {
    latitude: 37.7749,
    longitude: -122.4194,
    altitude: 0,
    accuracy: 100,
    altitudeAccuracy: 100,
    heading: 0,
    speed: 0,
  },
  timestamp: Date.now()
};

function App() {
  useGeolocationDevTools({
    initialPosition: customPosition
  });

  return <YourApp />;
}
```

## Opening DevTools

1. Start your React Native app with Metro bundler
2. Press `j` in the Metro terminal to open DevTools
3. Enable the **Geolocation** plugin from the Rozenite DevTools panel
4. Start mocking locations!

## Features

### Interactive Map Control
- **Click to set location**: Click anywhere on the map to instantly update device position
- **Visual feedback**: Real-time marker updates as you change location
- **Zoom and pan**: Full map navigation support

### Keyboard Navigation
Use arrow keys for precise position adjustments:
- `↑` Move north
- `↓` Move south
- `←` Move west
- `→` Move east

### Manual Input
Enter exact coordinates via input fields:
- **Latitude**: Direct decimal degree input
- **Longitude**: Direct decimal degree input
- Auto-updates map and position when changed

### Location Presets
Quick access to 20 major cities worldwide:

**Asia-Pacific**: Seoul, Tokyo, Beijing, Singapore, Mumbai, Sydney

**Europe**: London, Paris, Berlin, Moscow, Istanbul

**Americas**: New York, Los Angeles, São Paulo, Mexico City, Toronto, Buenos Aires

**Middle East & Africa**: Dubai, Cairo, Johannesburg

### Real-time Position Data

The plugin automatically calculates and updates:
- **Heading**: Direction of movement (0-360°)
- **Speed**: Velocity based on distance over time (m/s)
- **Accuracy**: Position accuracy in meters
- **Altitude**: Optional altitude data
- **Timestamp**: Precise update timing

## Demo

![DevTools Plugin in Action](https://raw.githubusercontent.com/jingjing2222/react-native-nitro-geolocation/main/devtools.gif)

## How It Works

The DevTools plugin uses an event-driven architecture:

1. **Ready Signal**: DevTools UI sends a "ready" signal when mounted
2. **Initial Position**: App responds with the configured initial position
3. **Position Updates**: UI sends position changes to the app in real-time
4. **Global State**: Position data is stored globally and accessible to all geolocation APIs

```tsx
// Behind the scenes
useGeolocationDevTools() → Sets up message bridge
↓
DevTools UI opens → Sends "ready" signal
↓
App responds → Sends initial position
↓
User changes location → DevTools sends position update
↓
getCurrentPosition() / useWatchPosition() → Returns mocked position
```

## Development Workflow

### Typical Usage

```tsx
import { useGeolocationDevTools, createPosition } from '@react-native-nitro-geolocation/rozenite-plugin';
import { useWatchPosition } from 'react-native-nitro-geolocation';

function App() {
  // 1. Enable devtools with initial position
  useGeolocationDevTools({
    initialPosition: createPosition('Tokyo, Japan')
  });

  // 2. Use geolocation as normal
  const { position } = useWatchPosition({ enabled: true });

  return (
    <Map
      latitude={position?.coords.latitude}
      longitude={position?.coords.longitude}
    />
  );
}
```

### Testing Scenarios

**Test navigation**:
1. Select a start location from presets
2. Click a destination on the map
3. Observe your app update in real-time

**Test accuracy handling**:
1. Monitor the accuracy value in DevTools
2. Test how your app handles low accuracy readings

**Test movement**:
1. Use arrow keys for smooth movement
2. Verify heading and speed calculations
3. Test distance-based triggers

## Important Notes

:::warning Production Builds
The DevTools plugin should only be enabled in development builds. Rozenite DevTools is automatically disabled in production, so no additional configuration is needed.
:::

:::tip
The plugin integrates seamlessly with both Modern and Legacy APIs. No code changes needed in your existing geolocation logic.
:::

## Troubleshooting

**DevTools not connecting**:
- Ensure Rozenite DevTools is properly installed
- Check that you've enabled the Geolocation plugin in the DevTools panel
- Try closing and reopening DevTools (press `j` again)

**Position not updating**:
- Verify `useGeolocationDevTools()` is called before any geolocation APIs
- Check Metro bundler logs for errors
- Ensure DevTools panel is open and plugin is enabled

**Initial position not applied**:
- Make sure DevTools is open when the app starts
- The ready signal may be delayed - try reloading the app

## Source Code

View the full source code on GitHub:
- [Plugin Repository](https://github.com/mrousavy/react-native-nitro-geolocation/tree/main/packages/rozenite-devtools-plugin)
- [Report Issues](https://github.com/mrousavy/react-native-nitro-geolocation/issues)
