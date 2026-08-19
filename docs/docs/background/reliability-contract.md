# Background Reliability Contract

Background location is a native, best-effort pipeline. Starting it means the
library has registered the platform mechanisms described below; it does not
promise a fixed delivery interval while the app is backgrounded, suspended,
terminated, force-stopped, or constrained by battery policy.

## Runtime states

| App/device state | Android contract | iOS contract |
| --- | --- | --- |
| Foreground | The foreground service owns continuous updates. Live JS listeners receive events while the React runtime exists; retained events remain available through the storage APIs. | Core Location runs with the selected mode. Live JS listeners receive events while the React runtime exists; retained events remain available through the storage APIs. |
| Background or screen off | A visible location foreground service continues when permissions and OS policy allow it. Native storage records retained events, and Headless JS is attempted when no in-process listener is available. | `allowsBackgroundLocationUpdates` and the Location background mode allow Core Location delivery, but iOS controls timing and may suspend the process. Significant-change and region monitoring are more restart-friendly than continuous standard updates. |
| Task removed / process killed | `stopOnTerminate: true` stops tracking. With `false`, the service requests sticky restart, but OEM policy, Android background-start limits, permission changes, or resource pressure can still prevent or delay it. | System termination is not a continuous-delivery guarantee. Significant-change or region monitoring may allow a later system relaunch; standard updates and arbitrary JS execution are not promised. |
| User force-stop / force-quit | Android stops the service and suppresses receivers until the user launches the app again. No library option overrides force-stop. | Treat user force-quit as stopped. Do not depend on background relaunch until the user opens the app again. |
| Device reboot | With `startOnBoot: true`, persisted configuration, `RECEIVE_BOOT_COMPLETED`, and valid permissions, the boot receiver attempts to restore geofences and tracking. OS/OEM policy can delay or reject the start. | There is no `startOnBoot` contract or boot receiver. Re-establish the desired tracking session after the app is launched. |

`stopOnTerminate` and `startOnBoot` keep their existing defaults. This API does
not silently enable foreground services, Headless JS, storage, boot restore, or
persistence.

## Status timestamps

`getBackgroundLocationStatus()` includes two optional native-storage fields:

```ts
const status = await getBackgroundLocationStatus();

console.log(status.lastLocationAt); // newest retained native location record
console.log(status.lastEventAt);    // newest retained native event
```

Both values are Unix timestamps in milliseconds. They are absent when no
matching record is retained, such as in a fresh or reset store. With
`persist: false`, new records do not advance these fields, but previously
retained records remain visible until they are removed. The fields describe
native recording, not a promise that a live JS listener, Headless task, server
sync, or application UI consumed the record.
Compare them with your own run marker and inspect stored rows instead of using
the counters alone.

## Verification matrix

| Scenario | Android automation | iOS automation | Physical-device/manual proof |
| --- | --- | --- | --- |
| Foreground start/stop and invalid configuration | `background-e2e.yaml` | `background-e2e.yaml` | Confirm permission and notification UX on the target OS versions. |
| Background delivery with React UI inactive | `background-long-run-android.yaml` injects movement after Home and requires retained locations/events plus fresh status timestamps. | `background-long-run-ios.yaml` injects movement after Home and requires native storage drain plus fresh status timestamps. | Lock the screen and walk/drive long enough to exceed the configured distance and interval filters. |
| JS unavailable | Android long-run requires delivered Headless JS event flags. | iOS has no Headless JS contract; verify storage drain after reopening. | Terminate the React runtime without force-stopping the app, then inspect native storage and logs. |
| Geofence enter/exit | Android long-run injects outside → inside → outside and requires both transitions. | Not part of the simulator reliability gate. | Cross the boundary on real hardware; account for OS batching and region limits. |
| Reboot restore | Optional `RUN_REBOOT=1` emulator pass verifies post-boot locations and geofences after a new proof marker. | Not supported. | Test reboot on each Android OEM targeted by the app; keep failures visible. |
| User force-stop / force-quit | Not asserted as recoverable. Relaunch is required. | Not asserted as recoverable. Relaunch is required. | Verify the app reports stopped/stale state after the user reopens it. |

See [Long-Run Background E2E](/background/long-run-e2e) for commands and
coordinates. A failed device-policy case is evidence to diagnose, not a reason
to weaken the assertion.
