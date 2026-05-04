---
"react-native-nitro-geolocation": minor
---

Add platform-specific accuracy presets to the Modern API while preserving `enableHighAccuracy`.
Android now supports `high`, `balanced`, `low`, and `passive` presets, and iOS supports Core Location accuracy presets including `bestForNavigation`, `nearestTenMeters`, and `reduced`.
`enableHighAccuracy` is now deprecated for the Modern API in favor of explicit accuracy presets.
