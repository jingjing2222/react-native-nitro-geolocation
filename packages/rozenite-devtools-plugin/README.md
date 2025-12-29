# @rozenite/react-native-nitro-geolocation-plugin

Rozenite DevTools Plugin for [react-native-nitro-geolocation](https://github.com/mrousavy/react-native-nitro-geolocation). Mock geolocation data in development with an interactive map interface.

> **⚠️ Prerequisites**: This plugin requires [Rozenite DevTools](https://github.com/rozenite/rozenite) to be set up in your project. Follow the [Rozenite installation guide](https://rozenite.dev/docs/getting-started) to configure DevTools before using this plugin.

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
npm install @rozenite/react-native-nitro-geolocation-plugin
# or
yarn add @rozenite/react-native-nitro-geolocation-plugin
```

## Usage

Add the devtools hook to your app:

```tsx
import { useGeolocationDevTools } from '@rozenite/react-native-nitro-geolocation-plugin';

function App() {
  useGeolocationDevTools();

  return <YourApp />;
}
```

### With initial position

```tsx
import { useGeolocationDevTools } from '@rozenite/react-native-nitro-geolocation-plugin';
import { createPosition } from '@rozenite/react-native-nitro-geolocation-plugin/presets';

function App() {
  useGeolocationDevTools({
    initialPosition: createPosition('Tokyo, Japan')
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
