# iOS Location Lifecycle

Observe the moments when Core Location pauses or resumes background location
updates:

```ts
import {
  onLocationLifecycleChange,
  startBackgroundLocation,
} from 'react-native-nitro-geolocation/background';

const lifecycleSubscription = onLocationLifecycleChange((event) => {
  if (event.state === 'paused') {
    console.log('Core Location paused updates', event.timestamp);
  } else {
    console.log('Core Location resumed updates', event.timestamp);
  }
});

await startBackgroundLocation({
  trackingMode: 'continuous',
  persist: true,
  ios: {
    activityType: 'fitness',
    pausesLocationUpdatesAutomatically: true,
  },
});

// Later, when the observer is no longer needed:
lifecycleSubscription.remove();
```

This listener reports the native
`locationManagerDidPauseLocationUpdates` and
`locationManagerDidResumeLocationUpdates` delegate callbacks. iOS decides
whether to pause based on the configured activity and device movement. After an
automatic pause, Core Location does not restart updates just because the device
moves: your app must call `startBackgroundLocation()` before iOS can report the
`resumed` callback. Starting or stopping tracking does not synthesize a
lifecycle event.

The listener is observational: it does not restart tracking, change the
background state, persist an event, or add an event to `onBackgroundEvent`.
Choose an app-specific restart policy after a pause if your use case needs one.

Android and web return a removable subscription but do not emit these iOS Core
Location events. Keep platform-independent cleanup code, but do not wait for a
pause or resume event outside iOS.

## Test on a real device

Automatic pausing is controlled by iOS and is not deterministic in a simulator
or short automated test. For an end-to-end check:

1. Install the example app on an iPhone and grant Always location access.
2. Open **iOS Location Lifecycle** and register the listener.
3. Start pause-eligible tracking, leave the device stationary, and wait for iOS
   to report `paused`.
4. Move to an appropriate place, then use **Restart Tracking After Pause**. This
   calls `startBackgroundLocation()` again; confirm that `resumed` appears.
5. Stop tracking, then remove the listener twice to confirm cleanup remains
   safe and idempotent.

The automated E2E scenario covers the deterministic boundary instead: it uses
the public API through the real native bridge, verifies that registration emits
no fabricated event, and removes the subscription twice. A separate native
delegate contract test invokes the real Core Location delegate methods and
verifies that `paused` and `resumed` reach the listener owner in order.
