# Activity Recognition

```ts
import {
  startActivityRecognition,
  onActivityChange,
} from 'react-native-nitro-geolocation/background';

await startActivityRecognition({
  enabled: true,
  interval: 10_000,
  stopOnStill: true,
  minimumConfidence: 70,
});

const sub = onActivityChange((activity) => {
  console.log(activity.type, activity.confidence);
});
```

Activity events are delivered through the same native event pipeline as location
and geofence events. Android uses Activity Recognition APIs. iOS uses Core
Motion when available.

On Android 10+, request `android.permission.ACTIVITY_RECOGNITION` at runtime
before calling `startActivityRecognition()` or using `trackingMode:
'activityAware'`.

`trackingMode: 'activityAware'` enables activity collection alongside background
tracking. Apps can use `onActivityChange` events to pause, resume, or tune
tracking policy for their own product rules.
