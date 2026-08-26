---
title: iOS background setup
description: Configure staged iOS location access, background mode, and optional motion access with product-specific purpose text.
---

# iOS background setup

Background Location requires a staged permission experience: demonstrate the
foreground feature with **When In Use**, then ask for **Always** only when the
user enables a feature that must run while the app is not active.

## Feature-to-capability map

| Product feature | `Info.plist` or capability | Runtime action |
| --- | --- | --- |
| Foreground fix | `NSLocationWhenInUseUsageDescription` | Request foreground permission from a user action |
| Background tracking or geofencing | `NSLocationAlwaysAndWhenInUseUsageDescription` and Background Modes → Location updates | Upgrade from When In Use to Always after explaining the background outcome |
| Activity-aware tracking | `NSMotionUsageDescription` | Start/request motion access only when enabling activity-aware behavior |
| Stored-event recovery | No additional permission | Drain native storage after JS initialization; apply the app's retention policy |

Do not add Always access, the location background mode, or Motion usage text to
an app that does not ship the corresponding feature.

## Add product-specific purpose text

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Show your position on the active delivery map.</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Record an active delivery route when the screen is locked.</string>
```

These are examples of specificity, not store-ready copy for every app. State the
actual user benefit and keep the in-app explanation consistent with the system
prompt and store privacy disclosure.

In Xcode, open the app target's **Signing & Capabilities**, add **Background
Modes**, and enable **Location updates**. The equivalent plist entry is:

```xml
<key>UIBackgroundModes</key>
<array>
  <string>location</string>
</array>
```

For standalone activity events or `trackingMode: 'activityAware'`, also add:

```xml
<key>NSMotionUsageDescription</key>
<string>Adjust route recording when your movement changes.</string>
```

## Request access in stages

1. Request When In Use when the user starts the foreground feature.
2. Let the user see the foreground value before presenting an Always rationale.
3. Request background permission when the user explicitly enables background
   tracking or geofencing.
4. If the OS keeps When In Use or the user denies the upgrade, wait for app
   resume, recheck state, and offer a user-chosen settings path. Do not loop.

Continue to [Background permissions](./permissions.md) for the API flow.

## Platform boundary and verification

iOS does not provide Android-style Headless JS. Native code can retain events
while JavaScript is unavailable, and the app can drain them after initialization.
Background execution remains subject to iOS policy; a killed app is not an
unbounded tracking guarantee.

Run `yarn nitro-geolocation doctor`, then verify When In Use, Always upgrade,
reduced accuracy, denial, app suspension, stored-event recovery, and any motion
flow on real devices. Before shipping, review the
[reliability contract](./reliability-contract.md) and
[privacy checklist](../guide/privacy-compliance.md).
