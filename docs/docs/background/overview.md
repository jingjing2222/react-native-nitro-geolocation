---
title: Background Location overview
description: Decide when to use native background location, understand platform limits, and follow the shortest setup path.
---

# Background Location overview

Use the Background API when the product must record location while the app is
not active, monitor geofences, recover events recorded while JavaScript was
unavailable, or run native delivery behavior. For an active screen, use
`useWatchPosition()` instead; it has a simpler permission and lifecycle model.

```ts
import {
  startBackgroundLocation,
  onBackgroundLocation,
  stopBackgroundLocation,
} from 'react-native-nitro-geolocation/background';
```

Keep the `/background` import explicit. It separates background permissions,
storage, and native services from foreground code and is safe for shared web
bundles to import, but background behavior itself is **native-only**.

## Understand the platform contract first

| State | Android | iOS |
| --- | --- | --- |
| App in foreground | Native updates can be delivered to JS | Native updates can be delivered to JS |
| App backgrounded | Foreground service with visible notification for continuous tracking | Core Location delivery under granted Always access and OS policy |
| JavaScript unavailable | Native persistence, Headless JS, and optional native sync are available | Native persistence is available; no Android-style Headless JS |
| App terminated or device rebooted | Feature- and OEM-dependent; optional boot restoration | No promise of continuous killed-app execution |
| Browser | Unsupported result/stub | Unsupported result/stub |

Background delivery is best effort, not an unbounded execution guarantee. Read
the [reliability contract](./reliability-contract.md) before promising behavior
for termination, reboot, suspension, or exact delivery timing.

## Complete the happy path

### 1. Configure one platform

- [Android background setup](./setup-android.md) separates foreground,
  continuous tracking, notification, activity, and boot permissions.
- [iOS background setup](./setup-ios.md) stages When In Use → Always and adds
  only the background/motion capabilities the feature needs.

Do not copy both platforms' complete permission lists into a foreground-only
app.

### 2. Request background access

[Background permissions](./permissions.md) requests foreground and background
access in the OS-required sequence and handles settings/app-resume round trips.
Ask only after explaining the user-facing background outcome.

### 3. Start and own the subscription

[Start and stop tracking](./start-stop.md) shows a complete continuous-tracking
flow, one subscription owner, cleanup, and explicit stop behavior. A visible
Android notification is part of the running product experience, not an
implementation detail.

### 4. Verify on a real device

Confirm foreground, background, screen lock, permission changes, process loss,
stored-event recovery, and any reboot behavior your app claims. Use the
[long-run E2E guide](./long-run-e2e.md) and test the Android OEMs/iOS versions
you ship.

The minimum success outcome is:

- permission status reports foreground and background granted;
- tracking status reports configured and started;
- a live location is received while the app is active and backgrounded;
- persisted events can be drained after JavaScript restarts when persistence is
  enabled;
- stopping tracking removes the listener and native tracking state.

## Add advanced behavior only when needed

- [Storage Recovery](./storage.md) for events recorded while JavaScript was not
  running. Consumers must process recovered IDs idempotently.
- [Android Headless JS](./headless-js.md) for Android JavaScript delivery when
  the app process can be started for a task.
- [Native HTTP Sync](./http-sync.md) for native delivery. Treat endpoints,
  credentials, retention, retries, and server deduplication as security/product
  contracts.
- [Geofencing](./geofencing.md) for enter/exit behavior with documented platform
  limits.
- [Activity Recognition](./activity-recognition.md) for standalone activity
  events or activity-aware tracking and its extra permission.
- [iOS Location Lifecycle](./location-lifecycle.md) for automatic pause and
  app-triggered resume observation.
- [2.0 Unified Background Events](../guide/v2-unified-background-events.md) when
  upgrading stored provider or lifecycle event consumers.

## Diagnose silent delivery

```ts
import {
  diagnoseBackgroundLocation,
} from 'react-native-nitro-geolocation/background';

const diagnosis = await diagnoseBackgroundLocation();

if (!diagnosis.healthy) {
  console.warn(diagnosis.issues.join('\n'));
}
```

The diagnosis returns `{ healthy, status, issues }` and identifies recorded
native errors, missing permissions, disabled device services, a configured but
stopped tracker, notification/service problems, or a tracker still waiting for
a fix. Continue to [Background troubleshooting](./troubleshooting.md).

## Type imports

Background code can import its contracts from the same self-contained subpath:

```ts
import type {
  BackgroundLocation,
  BackgroundLocationOptions,
  BackgroundLocationStatus,
  GeolocationResponse,
  LocationError,
  PermissionStatus,
} from 'react-native-nitro-geolocation/background';
```

Before shipping persistence or native sync, complete the
[Privacy and Compliance](../guide/privacy-compliance.md) and
[Release readiness](../guide/release-readiness.md#ship-checklist) reviews.
