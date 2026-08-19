---
"react-native-nitro-geolocation": major
---

Split last-known position reads into synchronous module-cache and asynchronous
platform-cache APIs. `getLastKnownPosition()` now returns the module cache
immediately, while `getLastKnownPositionAsync(options)` queries cache-only native
sources or filters observed Web and DevTools caches without starting a fresh
location request.
