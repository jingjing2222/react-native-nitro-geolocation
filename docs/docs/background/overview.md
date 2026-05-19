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

## Where to go next

- [Android Setup](/background/setup-android) and [iOS Setup](/background/setup-ios) - add the required native permissions and capabilities.
- [Permissions](/background/permissions) - request foreground/background access and handle settings round-trips.
- [Start And Stop](/background/start-stop) - start continuous tracking and subscribe to native updates.
- [Storage Recovery](/background/storage) - drain events recorded while JavaScript was not running.
- [Geofencing](/background/geofencing), [Activity Recognition](/background/activity-recognition), and [Native HTTP Sync](/background/http-sync) - add advanced background behavior.
