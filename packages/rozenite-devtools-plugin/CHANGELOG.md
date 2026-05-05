# @react-native-nitro-geolocation/rozenite-plugin

## 1.1.0

### Minor Changes

- d54aa44: Add optional `mocked` and `provider` metadata to root location responses with Android and iOS native mappings.
  Add `GeolocationConfiguration` as the preferred root API configuration type while preserving `ModernGeolocationConfiguration` as a deprecated compatibility alias.
  Keep the Compat API response shape unchanged for the drop-in replacement contract.
  Normalize missing native coordinate values to explicit `null` unions and include the same metadata in Rozenite DevTools mock responses.

## 1.0.3

### Patch Changes

- b84154b: Guard geolocation devtools activation behind React Native `__DEV__`.
- 0fe3880: Fix repository links in the DevTools plugin documentation.

## 1.0.2

### Patch Changes

- fc0e59d: Build the Rozenite plugin during package publishing so the generated `dist` assets are always included in releases.
- 2d30232: Change the package license to MIT.

## 1.0.1

### Patch Changes

- chore: license, README

## 1.0.0

### Major Changes

- feat: Initial release of Rozenite DevTools Plugin for geolocation mocking
- feat: Interactive map-based position control with Leaflet
- feat: Location presets for 20 major cities worldwide
- feat: Manual coordinate input for precise control
- feat: Keyboard navigation with arrow keys
- feat: Real-time position updates with calculated heading, speed, and accuracy
- feat: Dark mode support with system detection
- feat: Type-safe event-driven architecture with ready signal pattern
