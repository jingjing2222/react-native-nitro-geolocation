# @react-native-nitro-geolocation/rozenite-plugin

Rozenite DevTools Plugin for [react-native-nitro-geolocation](https://github.com/mrousavy/react-native-nitro-geolocation). Mock geolocation data in development with an interactive map interface.

> **⚠️ Prerequisites**: This plugin requires [Rozenite DevTools](https://github.com/rozenite/rozenite) to be set up in your project. Follow the [Rozenite installation guide](https://rozenite.dev/docs/getting-started) to configure DevTools before using this plugin.

> **ℹ️ API Compatibility**: This DevTools plugin only works with the **Modern API** (`react-native-nitro-geolocation`). It does not support the Legacy API (`react-native-nitro-geolocation/compat`).

## Demo

![DevTools Plugin Demo](https://raw.githubusercontent.com/jingjing2222/react-native-nitro-geolocation/main/devtools.gif)

## Features

- 🗺️ Interactive map-based position control
- 📍 Click on map to set location
- ⌨️ Arrow key navigation for precise adjustments
- 🏙️ 20 pre-configured city locations
- ✏️ Manual latitude/longitude input
- 📊 Real-time heading, speed, and accuracy calculation
- 🌓 Dark mode support

## Installation

```bash
npm install @react-native-nitro-geolocation/rozenite-plugin
# or
yarn add @react-native-nitro-geolocation/rozenite-plugin
```

## Usage

Add the devtools hook to your app:

```tsx
import { useGeolocationDevTools } from '@react-native-nitro-geolocation/rozenite-plugin';

function App() {
  useGeolocationDevTools();

  return <YourApp />;
}
```

### With initial position

#### Using city presets

```tsx
import { useGeolocationDevTools, createPosition } from '@react-native-nitro-geolocation/rozenite-plugin';

function App() {
  useGeolocationDevTools({
    initialPosition: createPosition('Dubai, UAE')
  });

  return <YourApp />;
}
```

#### Using custom coordinates

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

### Available city presets

Seoul, Tokyo, Beijing, Singapore, Mumbai, London, Paris, Berlin, Moscow, Istanbul, New York, Los Angeles, São Paulo, Mexico City, Toronto, Sydney, Dubai, Cairo, Johannesburg, Buenos Aires

## Opening DevTools

1. Start your React Native app with Metro
2. Press `j` in the Metro terminal
3. Enable the Geolocation plugin in DevTools
4. Start mocking locations!

## Controls

- **Click map**: Set location instantly
- **Arrow keys**: Move position precisely
- **Input fields**: Enter exact coordinates
- **Dropdown**: Select city preset

## License

MIT
