# Watch observability

Use `getActiveWatches()` to inspect the Modern API watches that currently own
native position or heading subscriptions:

```ts
import {
  getActiveWatches,
  stopObserving,
  unwatch,
  watchPosition,
} from 'react-native-nitro-geolocation';

const token = watchPosition(
  (position) => console.log(position.coords),
  (error) => console.error(error),
  { distanceFilter: 10 },
);

console.log(getActiveWatches());
// [{ token: '...', kind: 'position' }]

unwatch(token);
console.log(getActiveWatches()); // []

// Emergency or session-level cleanup:
stopObserving();
```

`getActiveWatches()` is a synchronous, point-in-time snapshot. It does not
request permission, start a provider, retain callbacks, or subscribe to future
changes. Entries are sorted by token and contain:

- `token`: the value accepted by `unwatch()`.
- `kind`: `position` for `watchPosition()` or `heading` for `watchHeading()`.

The snapshot covers the Modern API root import. It does not include Compat API
watches, one-shot position or heading requests, or Background Location.
Android watches that finish because of `maxUpdates` disappear from the next
snapshot automatically. Web snapshots include active browser position watches;
unsupported web heading requests are not reported as active.

## Cleanup semantics

- `unwatch(token)` removes a matching position or heading watch. Repeating it,
  or passing an unknown token, is safe and has no effect.
- `stopObserving()` removes every Modern API position and heading watch,
  including development-tool and browser watches. It does not cancel one-shot
  position requests or Background Location. On iOS it also leaves one-shot
  heading requests running. On Android, the current native heading manager
  discards pending one-shot heading requests and their timeouts without invoking
  a callback; avoid calling `stopObserving()` while `getHeading()` is pending.
- `useWatchPosition()` owns its token and calls `unwatch()` during React effect
  cleanup. Low-level `watchPosition()` callers own cleanup themselves.
- On Android, adding or removing a position watch restarts the one shared native
  position request when another watch remains. On iOS, it reconfigures the
  shared `CLLocationManager`; it restarts only when the selected Core Location
  mode changes.

## Watch Manager v2 default

Multiple position watches share native resources. Options are merged to serve
the most demanding active acquisition, while callback delivery is evaluated
against each subscription's own thresholds. A one-shot request or a second
watch may make native acquisition more demanding, but cannot lower an existing
watch's delivery threshold or move its last-delivered baseline.

### Android

Active position watches share one Fused Location or platform request. The
native request uses:

- the most demanding accuracy;
- the smallest `interval`, `fastestInterval`, `distanceFilter`,
  `maxUpdateAge`, and `maxUpdateDelay` values;
- `waitForAccurateLocation` when any watch requests it;
- coarse granularity when any watch explicitly requires coarse, otherwise fine
  when any watch explicitly requires fine, otherwise permission granularity.

`maxUpdates` remains per subscription. Reaching the limit removes only that
watch, then stops or restarts the shared request as needed. For callback
delivery, the first native position establishes each watch's baseline. Later
positions must satisfy that watch's own `interval` and `distanceFilter`, both
measured from its last delivered position; suppressed native updates do not move
the baseline or count toward `maxUpdates`. `fastestInterval` still contributes
to the shared native request, while `interval` is the per-watch minimum callback
period. Position watch registration, removal, native restart decisions, and
callback delivery are serialized on Android's main looper. A callback may safely
remove itself or another watch; a watch removed before its turn in the current
native update is skipped. Heading watches use the Android sensor manager
separately and apply each subscription's `headingFilter` independently.

### iOS

Position watches and pending one-shot position requests share one
`CLLocationManager`. The manager uses:

- the most precise requested accuracy and smallest distance filter;
- the highest-ranked activity type used by the current implementation;
- automatic pausing only when every explicit preference allows it;
- the background indicator or significant-change mode when any consumer asks
  for it.

Changing significant-change mode stops and restarts Core Location. Other
position option changes reconfigure the existing manager. Each position watch
receives its first native position, then applies its own `distanceFilter` from
the last position delivered to that watch. A nearby update accepted for a more
demanding watch or one-shot request no longer leaks into a less frequent watch.
Core Location does not expose the Android `interval` option. Heading watches
share the same manager's heading sensor separately and apply each subscription's
`headingFilter` independently.

### Web

Each position watch maps to its own `navigator.geolocation.watchPosition()`
call. Browser watches are not merged. The package applies each watch's
`distanceFilter` in JavaScript.

## Migration note

The v1.x native managers delivered every shared native position to every watch,
so adding a more demanding watch or one-shot request could increase callbacks
for existing consumers. In v2, code that intentionally relied on that leakage
must lower the affected watch's own `interval` or `distanceFilter`. Continue to
call `unwatch(token)` for component-local cleanup and reserve `stopObserving()`
for session-wide cleanup.
