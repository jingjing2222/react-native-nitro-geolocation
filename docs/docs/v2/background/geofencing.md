# Geofencing

```ts
import {
  addGeofences,
  onGeofence,
  removeGeofences,
} from 'react-native-nitro-geolocation/background';

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

// When this JavaScript owner is disposed:
sub.remove();

// When the product no longer needs the native region:
await removeGeofences(['office']);
```

`sub.remove()` detaches this JavaScript listener but leaves native monitoring in
place. `removeGeofences()` unregisters the named native regions; call it only
when the product should stop monitoring them.

`notifyOnDwell` is Android-only. iOS region monitoring supports enter and exit.
