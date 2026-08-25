# Storage Recovery

JavaScript listeners are delivery. Native storage is the source of truth.

```ts
import {
  getStoredBackgroundLocations,
  markStoredBackgroundLocationsDelivered,
} from 'react-native-nitro-geolocation/background';

const locations = await getStoredBackgroundLocations({
  includeDelivered: false,
  limit: 100,
});

await uploadToYourServer(locations);

await markStoredBackgroundLocationsDelivered(
  locations.map((location) => location.id)
);
```

Use `getStoredBackgroundEvents()` for mixed event recovery. In 2.x this includes
iOS `lifecycle` events when persistence is enabled. `providerChange` events are
live snapshots for active JavaScript subscriptions and are not written to the
background store.
