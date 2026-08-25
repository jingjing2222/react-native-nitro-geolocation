---
title: 2.0 Unified Background Events
---

# 2.0 Unified Background Events

React Native Nitro Geolocation 2.0 routes provider status and iOS Core Location
lifecycle changes through `onBackgroundEvent`. A single subscription now
observes every background event kind.

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
    default:
      handleExistingBackgroundEvent(event);
  }
});

subscription.remove();
```

Each subscription receives its own initial `providerChange` snapshot. Later
provider changes are delivered once per active subscriber. Removing a
subscription removes its provider watcher as well, so a direct
`getProviderStatus()` call can return a newer value without changing removed
event counters.

Provider snapshots are live-only and are not stored. iOS `lifecycle` events are
stored when the background configuration has persistence enabled, matching
location, geofence, activity, and HTTP sync events. Android does not synthesize
Core Location lifecycle events.

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

`BackgroundEvent` now includes the `lifecycle` discriminant. Add that case to
exhaustive switches before upgrading. The native-only
`addLocationLifecycleListener` and `removeLocationLifecycleListener` methods
are no longer part of the generated Nitro contract; application code should
use the public functions above.
