---
"react-native-nitro-geolocation": major
---

Remove `enableHighAccuracy` from the Modern API. Modern requests and Android
settings now use explicit platform `accuracy` presets, while the `/compat`
entry point retains `enableHighAccuracy` for drop-in compatibility.
