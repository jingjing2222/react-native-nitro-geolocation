---
"react-native-nitro-geolocation": minor
---

Extend the Modern API location error contract with `INTERNAL_ERROR`, `PLAY_SERVICE_NOT_AVAILABLE`, and `SETTINGS_NOT_SATISFIED`. Native code now sends structured `{ code, message }` error classification directly to both callbacks and public Promise rejections, while preserving the `/compat` legacy error shape.
