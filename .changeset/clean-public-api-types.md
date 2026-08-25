---
"react-native-nitro-geolocation": patch
---

Align the native and browser public API surfaces, export a named
`UseWatchPositionResult`, and keep background function declarations expressed
in public types instead of inferred Nitro spec signatures. Background provider
configuration now uses the same public `"android"` spelling as the root and
compat APIs while retaining `"android_platform"` only inside the Nitro bridge.
The `LocationErrorCode` type and `LocationErrorCodes` runtime constants now
have distinct names so type-only and value imports are unambiguous. Public
schema types no longer originate from Nitro spec declarations, background
bridge envelopes remain internal, and activity recognition and last-known
position use option types limited to the fields those operations support.
One-shot position options no longer advertise the watch-only `maxUpdates`.
Location availability reasons are also exposed as a consistent typed union
across native and web implementations.
