---
title: 2.0 Unified Background Events
---

# 2.0 Unified Background Events

React Native Nitro Geolocation 2.0 routes provider status and iOS Core Location
lifecycle changes through `onBackgroundEvent`. Android custom notification
actions also use this stream. A single subscription now observes every
background event kind.

```ts
import { onBackgroundEvent } from 'react-native-nitro-geolocation/background';

const subscription = onBackgroundEvent((event) => {
  switch (event.type) {
    case 'providerChange':
      console.log(event.providerStatus.locationServicesEnabled);
      break;
    case 'lifecycle':
      console.log(event.lifecycle.state, event.lifecycle.timestamp);
      break;
    case 'notificationAction':
      console.log(event.notificationAction.actionId);
      break;
    default:
      handleExistingBackgroundEvent(event);
  }
});

subscription.remove();
```

On Android and iOS, each subscription receives its own initial
`providerChange` snapshot. Later provider changes are delivered once per active
subscriber. Removing a subscription removes its provider watcher as well, so a
direct `getProviderStatus()` call can return a newer value without changing
removed event counters. Web background listeners remain no-op subscriptions and
do not emit an initial provider snapshot.

Provider snapshots are live-only and are not stored. iOS `lifecycle` events are
stored when the background configuration has persistence enabled, matching
location, geofence, activity, HTTP sync, and Android `notificationAction` events.
Android does not synthesize Core Location lifecycle events. Custom notification
actions are Android-only; see [Android setup](../background/setup-android.md#custom-notification-actions-20)
for configuration and Headless JS delivery.

## Migrate lifecycle listeners

`onLocationLifecycleChange()` remains as a convenience API, but in 2.x it is a
filter over the unified stream rather than a separate native listener channel.
Existing call sites can remain unchanged:

```ts
import { onLocationLifecycleChange } from 'react-native-nitro-geolocation/background';

const subscription = onLocationLifecycleChange(({ state }) => {
  if (state === 'paused') showPausedTrackingState();
});
```

The behavior is still observational. A pause does not automatically restart
tracking, and start/stop calls do not fabricate lifecycle events.

## Update exhaustive event handling

`BackgroundEvent` includes the `lifecycle` and `notificationAction` discriminants
in 2.0. Handle these alongside `providerChange` in exhaustive switches before
upgrading, even when a particular platform or app configuration never emits
them. The native-only
`addLocationLifecycleListener` and `removeLocationLifecycleListener` methods
are no longer part of the generated Nitro contract; application code should
use the public functions above.
