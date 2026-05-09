---
title: Migration Demo
---

# Migration Demo

The safest migration from `@react-native-community/geolocation` is two-step:
switch imports to `/compat` first, verify the app still behaves the same, then
move call sites to the Modern API.

## Step 1: Community package

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

## Step 2: Drop-in `/compat`

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

## Step 3: Modern API

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

## Agent-Assisted Migration

This repository also ships an Agent Skills-compatible migration playbook:

```bash
npx skills add jingjing2222/react-native-nitro-geolocation --skill community-migration
```

The skill first rewrites community imports to `/compat`, then guides a coding
agent through Modern API refactors with explicit checks for permission timing,
watch cleanup, cached reads, accuracy, and Android provider/settings handling.

For apps using `react-native-geolocation-service`, use the direct Modern API
skill instead:

```bash
npx skills add jingjing2222/react-native-nitro-geolocation --skill service-migration
```

That path does not introduce `/compat`.
