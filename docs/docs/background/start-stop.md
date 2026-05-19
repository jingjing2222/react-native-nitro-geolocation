# Start And Stop

```ts
import {
  checkBackgroundPermission,
  requestBackgroundPermission,
  startBackgroundLocation,
  stopBackgroundLocation,
  onBackgroundLocation,
} from 'react-native-nitro-geolocation/background';

let subscription;

export async function requestAndMaybeStartTracking() {
  const permission = await requestBackgroundPermission();

  if (permission.needsSettingsRedirect) {
    // Register an AppState "active" handler and call resumeBackgroundTracking()
    // after the user returns from settings or the authorization prompt settles.
    return;
  }

  await startIfAllowed(permission);
}

export async function resumeBackgroundTracking() {
  const permission = await checkBackgroundPermission();
  await startIfAllowed(permission);
}

async function startIfAllowed(permission) {
  if (permission.foreground === 'granted' && permission.background === 'granted') {
    await startBackgroundLocation({
      trackingMode: 'continuous',
      interval: 10_000,
      fastestInterval: 5_000,
      distanceFilter: 25,
      persist: true,
      android: {
        foregroundService: {
          notificationTitle: 'Location tracking active',
          notificationText: 'Your location is being recorded',
        },
      },
    });

    subscription?.remove();
    subscription = onBackgroundLocation(console.log);
  }
}

export async function stopTracking() {
  await stopBackgroundLocation();
  subscription?.remove();
  subscription = undefined;
}
```

Use [Activity Recognition](/background/activity-recognition) before switching to
`trackingMode: 'activityAware'`. Use [Android Setup](/background/setup-android)
before enabling boot restart or changing foreground-service behavior.
