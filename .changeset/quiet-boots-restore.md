---
"react-native-nitro-geolocation": patch
---

Fix Android boot crashes on older Android versions by adding an explicit timing constraint to the geofence restoration job. Skip restoration when no geofences are stored and handle scheduling errors without crashing the app process.
