# Activity Recognition

```ts
import {
  startActivityRecognition,
  onActivityChange,
} from 'react-native-nitro-geolocation/background';

await startActivityRecognition({
  interval: 10_000,
  stopOnStill: true,
  minimumConfidence: 70,
});

const sub = onActivityChange((activity) => {
  console.log(activity.type, activity.confidence);
});
```

Calling `startActivityRecognition()` enables the standalone activity stream, so
its options do not include `enabled`. Use `activityRecognition.enabled` only
inside `BackgroundLocationOptions` when activity recognition is controlled by
background tracking configuration.

Activity events are delivered through the same native event pipeline as location
and geofence events. Android uses Activity Recognition APIs. iOS uses Core
Motion when available.

On iOS, starting standalone or activity-aware tracking waits for the Core Motion
authorization decision. It rejects when activity recognition is unavailable,
denied, restricted, or still undetermined after the permission timeout; it does
not report a silently inactive motion provider as running.

On Android 10+, request `android.permission.ACTIVITY_RECOGNITION` at runtime
before calling `startActivityRecognition()` or using `trackingMode:
'activityAware'`.

`trackingMode: 'activityAware'` enables activity collection alongside background
tracking. Apps can use `onActivityChange` events to pause, resume, or tune
tracking policy for their own product rules.
