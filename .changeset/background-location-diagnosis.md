---
"react-native-nitro-geolocation": minor
---

Add a `diagnoseBackgroundLocation()` helper and its `BackgroundLocationDiagnosis` type.

When the background pipeline is silent, it inspects the current status and returns human-readable, actionable reasons delivery may not be working — a recorded native error, missing foreground/background permission, disabled location services, a service that is configured but not running, or running with no fix yet — without callers having to interpret the raw status object. Returns `{ healthy, status, issues }`.

Also drops the internal `undefined as any` casts in the background bridge so the public typings flow through unchanged.
