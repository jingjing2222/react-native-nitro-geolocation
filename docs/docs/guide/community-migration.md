---
title: Community Migration
---

# Community Migration

Use this path for apps that import `@react-native-community/geolocation`,
`navigator.geolocation`, or `react-native-nitro-geolocation/compat`.

The safest migration is two-step: switch community imports to `/compat` first,
verify the app still behaves the same, then move call sites to the Modern API
where it improves ownership, permission timing, cache behavior, or Android
settings handling.

## Agent Skill

This repository ships an Agent Skills-compatible migration playbook for this
path:

```bash
npx skills add jingjing2222/react-native-nitro-geolocation --skill community-migration
```

The skill source is
[`skills/community-migration`](https://github.com/jingjing2222/react-native-nitro-geolocation/tree/main/skills/community-migration).

The bundled bootstrap script performs the first safe mechanical pass:

```bash
node <skill-dir>/scripts/migrate-to-compat.mjs --root <app-root>
```

After the compat bootstrap, use the skill to refactor selected call sites to the
Modern API.

## Migration Path

### Step 1: Community Package

```tsx
import Geolocation from '@react-native-community/geolocation';

Geolocation.getCurrentPosition(
  (position) => {
    console.log(position.coords.latitude, position.coords.longitude);
  },
  (error) => {
    console.error(error.message);
  },
  {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0
  }
);
```

### Step 2: Drop-In `/compat`

First install the Nitro packages:

```bash
yarn add react-native-nitro-modules react-native-nitro-geolocation
```

Then change only the import path:

```diff
- import Geolocation from '@react-native-community/geolocation';
+ import Geolocation from 'react-native-nitro-geolocation/compat';
```

Keep the callback call site unchanged while you verify the app:

```tsx
Geolocation.getCurrentPosition(
  (position) => {
    console.log(position.coords.latitude, position.coords.longitude);
  },
  (error) => {
    console.error(error.message);
  },
  {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0
  }
);
```

### Step 3: Modern API

After the `/compat` migration is stable, move individual call sites to the
Modern API:

```tsx
import {
  getCurrentPosition,
  requestLocationSettings,
  requestPermission,
  setConfiguration
} from 'react-native-nitro-geolocation';

setConfiguration({
  authorizationLevel: 'whenInUse',
  locationProvider: 'playServices'
});

const status = await requestPermission();

if (status === 'granted') {
  await requestLocationSettings({
    accuracy: { android: 'high' },
    interval: 5000,
    fastestInterval: 1000
  });

  const position = await getCurrentPosition({
    accuracy: { android: 'high', ios: 'best' },
    granularity: 'permission',
    waitForAccurateLocation: true,
    timeout: 15000,
    maximumAge: 0
  });

  console.log(position.coords.latitude, position.coords.longitude);
}
```

For React component watches, prefer `useWatchPosition` so subscription cleanup
is owned by the component lifecycle:

```tsx
import { useWatchPosition } from 'react-native-nitro-geolocation';

function LocationTracker() {
  const { position, error, isWatching } = useWatchPosition({
    enabled: true,
    accuracy: { android: 'balanced', ios: 'nearestTenMeters' },
    distanceFilter: 10
  });

  if (error) return <Text>{error.message}</Text>;
  if (!position) return <Text>{isWatching ? 'Waiting...' : 'Stopped'}</Text>;

  return (
    <Text>
      {position.coords.latitude}, {position.coords.longitude}
    </Text>
  );
}
```
