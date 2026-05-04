---
title: v2 Migration Guide
---

# v2 Migration Guide

Version 2.0 keeps the package split simple:

- Root import: `react-native-nitro-geolocation`
- Compat import: `react-native-nitro-geolocation/compat`

Use the root API for Promise functions and `useWatchPosition`. Use `/compat` when you need a drop-in replacement for `@react-native-community/geolocation`.

## Breaking Change

The root API configuration type was renamed:

```diff
- import type { ModernGeolocationConfiguration } from 'react-native-nitro-geolocation';
+ import type { GeolocationConfiguration } from 'react-native-nitro-geolocation';
```

```diff
- const config: ModernGeolocationConfiguration = {
+ const config: GeolocationConfiguration = {
    authorizationLevel: 'whenInUse',
    locationProvider: 'auto'
  };
```

No runtime configuration behavior changed. The rename only removes the root API naming prefix from the public type surface.

## Root Response Metadata

Root API responses now include optional metadata when the native platform exposes it:

```ts
type LocationProviderUsed =
  | 'fused'
  | 'gps'
  | 'network'
  | 'passive'
  | 'unknown';

type GeolocationResponse = {
  coords: GeolocationCoordinates;
  timestamp: number;
  mocked?: boolean;
  provider?: LocationProviderUsed;
};
```

Use optional checks because this metadata is platform-dependent:

```tsx
const position = await getCurrentPosition();

if (position.mocked === true) {
  showMockLocationWarning();
}
```

Avoid logic that requires `mocked === false` to mean a trusted physical device location. Older OS versions, platform gaps, and `/compat` responses can omit the field.

## Compat API

The `/compat` entry point intentionally keeps the drop-in response shape:

```ts
type GeolocationResponse = {
  coords: GeolocationCoordinates;
  timestamp: number;
};
```

Do not add `mocked` or `provider` handling to compat-only code unless you are intentionally migrating that code to the root API.

## Rozenite DevTools

The Rozenite plugin now returns the same root response metadata when mock location data is active. This lets app logic distinguish development mocks from real native locations through `position.mocked === true`.

When `mocked` is `false` or omitted, DevTools location updates should not be treated as active mock input for production-facing logic.

## Checklist

1. Replace `ModernGeolocationConfiguration` imports with `GeolocationConfiguration`.
2. Keep `/compat` imports unchanged for drop-in replacement paths.
3. Add optional `mocked === true` handling only where the app needs mock-location detection.
4. Treat `provider` as informational metadata, not a required routing primitive.
5. Run TypeScript and the relevant iOS/Android location flows after the migration.
