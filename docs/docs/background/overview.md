# Background Location

React Native Nitro Geolocation includes a dedicated Background Location API for background updates, geofencing, Android foreground-service tracking, native event persistence, Android Headless JS delivery, activity recognition events, start-on-boot, native HTTP sync, and stored event recovery.

Background tracking is separate from `watchPosition`. `watchPosition` is for active foreground sessions. Background Location uses native services, receivers, and storage so events can be recorded even when JavaScript is not currently running.

```ts
import {
  startBackgroundLocation,
  addGeofences,
  registerBackgroundTask,
} from 'react-native-nitro-geolocation/background';
```

Prefer `react-native-nitro-geolocation/background` so foreground and background
imports stay explicit and tree-shakable.
