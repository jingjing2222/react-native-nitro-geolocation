---
title: Android background setup
description: Declare only the Android permissions required by each enabled background-location feature.
---

# Android background setup

Start with the foreground setup, then add only the declarations required by the
background features your product enables. Android permission prompts must be
requested in stages; declarations alone do not grant access.

## Feature-to-permission map

| Product feature | Manifest declaration | Runtime request | OS note |
| --- | --- | --- | --- |
| Foreground fix | `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` | Foreground location | Fine users can still choose approximate access |
| Continuous background or geofencing | `ACCESS_BACKGROUND_LOCATION` | Foreground first, background later | Android 11+ sends the user through app settings for background access |
| Continuous foreground-service tracking | `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION` | None for the service itself | A visible location notification is always required while running |
| Tracking notification | `POST_NOTIFICATIONS` | Notification permission | Runtime permission on Android 13+; tracking still needs a visible service notification |
| Activity-aware tracking | `ACTIVITY_RECOGNITION` | Activity Recognition | Runtime permission on Android 10+ |
| Restart after reboot | `RECEIVE_BOOT_COMPLETED` | None | OEM restrictions still apply; only enable `startOnBoot` when the product needs it |
| Long-running service work | `WAKE_LOCK` | None | Used by native service infrastructure; it is not permission to run without OS limits |

The library manifest contributes its service/receiver infrastructure and the
foreground-service, activity, boot, and wake-lock declarations. Your merged app
manifest must still contain the foreground/background location and Android 13+
notification declarations used by your configuration.

If the app does not use optional background features, inspect the merged
manifest and remove inherited optional declarations with manifest-merger
`tools:node="remove"` rules as described in
[Privacy and Compliance](../guide/privacy-compliance.md#permissions-and-store-disclosures).

## Minimum continuous-tracking declarations

Use this set only when the app actually starts continuous background tracking:

```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

The library's merged manifest supplies:

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
```

Do not add `ACTIVITY_RECOGNITION` behavior unless you use standalone activity
events or `trackingMode: 'activityAware'`. Do not enable `startOnBoot` merely
because the library declares the boot receiver.

## Request in a user-understandable sequence

1. Explain and request foreground location while the user is using the feature.
2. Show the feature working in the foreground.
3. Explain why the specific product outcome needs access when the app is not
   active, then request background access.
4. On Android 13+, request notification permission before starting continuous
   tracking and explain the persistent tracking notification.
5. Request Activity Recognition only when enabling activity-aware behavior.

Continue to [Background permissions](./permissions.md) for the API flow. Never
loop a denied prompt or open settings without a user action and explanation.

## Verify the setup

After native generation and manifest merging:

```bash
yarn nitro-geolocation doctor
```

Inspect `android/app/build/intermediates/merged_manifests` (the exact Gradle path
can vary) to confirm that enabled capabilities are present and unused optional
capabilities are removed. Then test foreground grant, background grant, denied,
notification-denied, swipe-away, and reboot behavior on the Android versions and
OEMs you ship. The [reliability contract](./reliability-contract.md) defines what
the library can and cannot guarantee.
