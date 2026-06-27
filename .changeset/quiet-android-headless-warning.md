---
"react-native-nitro-geolocation": patch
---

Skip Android Headless JS dispatch when a live background listener already received the foreground-service event.

This prevents React Native from warning `No task registered for key NitroBackgroundLocationTask` on every Android background location update when apps use foreground-service tracking without registering a Headless JS task.
