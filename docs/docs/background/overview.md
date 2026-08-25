# Background Location

React Native Nitro Geolocation includes a dedicated Background Location API for background updates, geofencing, Android foreground-service tracking, native event persistence, Android Headless JS delivery, activity recognition events, start-on-boot, native HTTP sync, and stored event recovery.

Background tracking is separate from `watchPosition`. `watchPosition` is for active foreground sessions. Background Location uses native services, receivers, and storage so events can be recorded even when JavaScript is not currently running.

```ts
import {
  startBackgroundLocation,
  diagnoseBackgroundLocation,
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
- [iOS Location Lifecycle](/background/location-lifecycle) - observe Core Location automatic pause and app-triggered resume callbacks without synthetic events.
- [2.0 Unified Background Events](/guide/v2-unified-background-events) - migrate provider and iOS lifecycle observation to the single background event stream.
- [Troubleshooting](/background/troubleshooting) - use `diagnoseBackgroundLocation()` to interpret the native background status when delivery is silent.
- [Storage Recovery](/background/storage) - drain events recorded while JavaScript was not running.
- [Reliability Contract](/background/reliability-contract) - understand foreground, background, termination, reboot, iOS suspension, status timestamps, and the E2E matrix.
- [Geofencing](/background/geofencing), [Activity Recognition](/background/activity-recognition), and [Native HTTP Sync](/background/http-sync) - add advanced background behavior.

## Diagnose Silent Background Delivery

Use `diagnoseBackgroundLocation()` when background tracking is configured but
the app is not receiving locations. It reads `getBackgroundLocationStatus()`
and returns actionable issues instead of forcing app code to interpret every
status field.

```ts
import { diagnoseBackgroundLocation } from 'react-native-nitro-geolocation/background';

const diagnosis = await diagnoseBackgroundLocation();

if (!diagnosis.healthy) {
  console.warn(diagnosis.issues.join('\n'));
}
```

The result is `{ healthy, status, issues }`. `healthy` is `true` when no issues
were found, `status` is the raw background status, and `issues` contains
human-readable reasons delivery may be blocked, such as a native `lastError`,
missing foreground or background permission, disabled device location services,
tracking configured but not started, or Android foreground-service and
notification-permission problems.
