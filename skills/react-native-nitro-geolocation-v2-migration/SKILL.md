---
name: react-native-nitro-geolocation-v2-migration
description: Migrate React Native apps from react-native-nitro-geolocation v1.x to v2.0. Use when updating root API types, mocked/provider response metadata, Rozenite mock-location behavior, or preserving /compat drop-in replacement code.
---

# React Native Nitro Geolocation v2 Migration

Use this skill to migrate an app or library from `react-native-nitro-geolocation` v1.x to v2.0.

## Goal

Keep the package boundary clear:

- Root API: imports from `react-native-nitro-geolocation`
- Compat API: imports from `react-native-nitro-geolocation/compat`

Do not introduce `modern` as a new public type, variable, module, or API label. The root API is separated from compat by the empty package subpath, and compat is separated by `/compat`.

## Procedure

1. Inventory imports from `react-native-nitro-geolocation` and `react-native-nitro-geolocation/compat`.
2. Replace root API type imports named `ModernGeolocationConfiguration` with `GeolocationConfiguration`.
3. Leave `/compat` call sites unchanged when they are being used as a drop-in replacement for `@react-native-community/geolocation`.
4. Update root API response handling only where the app needs metadata:
   - `mocked?: boolean`
   - `provider?: 'fused' | 'gps' | 'network' | 'passive' | 'unknown'`
5. Treat `mocked` as optional. Prefer `position.mocked === true` checks for mock-location branches.
6. Avoid logic that requires `mocked === false` before accepting a real location. Some platforms or compat responses can omit the field.
7. Treat `provider` as informational unless the product explicitly has provider-specific behavior.
8. If Rozenite DevTools is installed, verify that mocked pages or development-only flows react to `mocked === true`, and that `mocked === false` or an omitted field does not activate mock-only logic.
9. Run the app's TypeScript check and the relevant iOS and Android location flows.

## Expected Code Changes

Root type rename:

```diff
- import type { ModernGeolocationConfiguration } from 'react-native-nitro-geolocation';
+ import type { GeolocationConfiguration } from 'react-native-nitro-geolocation';
```

Root mocked handling:

```tsx
const position = await getCurrentPosition();

if (position.mocked === true) {
  showMockLocationWarning();
}
```

Compat import that should usually remain unchanged:

```tsx
import Geolocation from 'react-native-nitro-geolocation/compat';
```

## Done Criteria

- No root API code imports `ModernGeolocationConfiguration`.
- `/compat` response handling still expects only `coords` and `timestamp`.
- Root API code treats `mocked` and `provider` as optional fields.
- Mock-location behavior is driven by `mocked === true`, not by coordinates alone.
- TypeScript and relevant native location tests pass.
