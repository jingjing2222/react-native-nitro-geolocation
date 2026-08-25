# Geofencing

```ts
import { addGeofences, onGeofence } from 'react-native-nitro-geolocation/background';

await addGeofences([
  {
    identifier: 'office',
    latitude: 37.5665,
    longitude: 126.978,
    radius: 150,
    notifyOnEntry: true,
    notifyOnExit: true,
    metadata: { kind: 'workplace' },
  },
]);

const sub = onGeofence((event) => {
  console.log(event.transition, event.region.identifier);
});
```

`notifyOnDwell` is Android-only. iOS region monitoring supports enter and exit.
