# Start And Stop

```ts
import {
  requestBackgroundPermission,
  startBackgroundLocation,
  stopBackgroundLocation,
  onBackgroundLocation,
} from 'react-native-nitro-geolocation/background';

const permission = await requestBackgroundPermission();

if (permission.foreground === 'granted' && permission.background === 'granted') {
  await startBackgroundLocation({
    trackingMode: 'activityAware',
    interval: 10_000,
    fastestInterval: 5_000,
    distanceFilter: 25,
    persist: true,
    stopOnTerminate: false,
    startOnBoot: true,
    android: {
      foregroundService: {
        notificationTitle: 'Location tracking active',
        notificationText: 'Your location is being recorded',
      },
    },
  });
}

const sub = onBackgroundLocation(console.log);
await stopBackgroundLocation();
sub.remove();
```
