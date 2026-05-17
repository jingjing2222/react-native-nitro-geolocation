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

Use `getStoredBackgroundEvents()` for mixed event recovery.
