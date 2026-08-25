---
"react-native-nitro-geolocation": patch
---

Align the native and browser public API surfaces, export a named
`UseWatchPositionResult`, and keep background function declarations expressed
in public types instead of inferred Nitro spec signatures. Background provider
configuration now uses the same public `"android"` spelling as the root and
compat APIs while retaining `"android_platform"` only inside the Nitro bridge.
