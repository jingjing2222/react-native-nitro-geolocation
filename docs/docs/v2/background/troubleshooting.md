# Troubleshooting

## Diagnose background delivery

Call `diagnoseBackgroundLocation()` when the background pipeline is silent. It
returns `{ healthy, status, issues }`, where `issues` lists the common blockers
derived from the native background status.

```ts
import { diagnoseBackgroundLocation } from 'react-native-nitro-geolocation/background';

const { healthy, issues } = await diagnoseBackgroundLocation();

if (!healthy) {
  console.warn(issues.join('\n'));
}
```

The helper checks the last native error, foreground and background permission,
device location services, configured/running state, stored location count, and
Android foreground-service or notification-permission state.

## Android tracking does not start

Check foreground location, background location, Android 13+ notification permission, and device location services. Continuous background tracking requires `android.foregroundService`.

If those values look correct but no locations arrive, inspect
`status.lastError` from `diagnoseBackgroundLocation()` or
`getBackgroundLocationStatus()`.

## Android starts but stops after swipe-away

Set `stopOnTerminate: false`. Vendor battery restrictions can still stop services.

## iOS killed-app behavior differs

iOS and Android have different background execution models. Authorization level, Low Power Mode, and termination state affect delivery.

## JS callback missed events

Read native storage with `getStoredBackgroundLocations()` or `getStoredBackgroundEvents()`.
