---
"react-native-nitro-geolocation": patch
---

Reduce location and heading hot-path work across Android, iOS, and Web by
deferring response conversion until delivery, reusing sensor buffers, avoiding
unchanged native configuration writes, and limiting iOS background persistence
to the collections that changed.
