---
"react-native-nitro-geolocation": major
---

Split last-known position reads into synchronous module-cache and asynchronous
platform-cache APIs. `getLastKnownPosition()` now returns the module cache
immediately, while `getLastKnownPositionAsync(options)` queries cached native or
browser sources without starting a fresh location request.
