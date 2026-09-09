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
iOS `lifecycle` and Android `notificationAction` events when persistence is
enabled. Custom notification actions can be selected with
`getStoredBackgroundEvents({ types: ['notificationAction'] })`.
`providerChange` events are live snapshots for active JavaScript subscriptions
and are not written to the background store.

Handle stored events idempotently using the event ID, then acknowledge them with
`markStoredBackgroundEventsDelivered()`. A notification action can reach the
live listener or Headless JS before the same event is recovered from storage.
