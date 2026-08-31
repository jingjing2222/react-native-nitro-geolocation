# @react-native-nitro-geolocation/rozenite-plugin

## 2.0.0-rc.0

### Major Changes

- 95e7509: Require Rozenite 2.2 and upgrade the DevTools package and example host. Mock
  watches now preserve the v2 per-subscription distance, Android interval,
  `maxUpdates`, and idempotent cleanup contracts. The default Seoul fixture is
  available immediately, and DevTools activation is released when the hook
  unmounts.

### Patch Changes

- 5e65d79: Simplify API terminology across package documentation, migration tooling,
  examples, and internal implementation names while keeping the Compat API
  unchanged.

## 1.1.2

### Patch Changes

- 7651df9: Refresh release documentation and simplify first-run guidance without changing
  package runtime behavior.

## 1.1.1

### Patch Changes

- 86d80e4: Add `sideEffects: false` to enable tree shaking in bundlers.

## 1.1.0

### Minor Changes

- d54aa44: Add optional `mocked` and `provider` metadata to location responses with Android and iOS native mappings.
  Add `GeolocationConfiguration` as the preferred API configuration type while preserving a deprecated compatibility alias.
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
