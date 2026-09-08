---
"react-native-nitro-geolocation": patch
---

Harden the 2.0 release candidate before freezing its stable contract:

- Keep iOS permission requests pending until a user decision and remove concurrent lazy watcher initialization.
- Settle cancelled requests even if native or browser startup/teardown throws; ignore results from stopped browser watches and prior React hook subscriptions.
- Implement Android foreground notification color and an optional native stop action scoped to its tracking run.
- Apply background accuracy/granularity, preserve storage and activity policies across Android restarts, and retain iOS accuracy in persisted configuration.
- Apply and restore Android geofencing defaults, and preserve a newer run's restart policy when an obsolete notification stop action arrives.
- Reject unsafe native numeric options and HTTP retry counts without integer-conversion crashes or retry overflow.
- RC contract correction: remove the never-implemented iOS deferred-delivery options from the public types and returned configuration. See the eighth item in the 2.0 migration guide.
- Fix stable documentation promotion, including RC navigation markers, the default 2.x routes, the 1.x archive, and redirects for existing /v2/ links.
