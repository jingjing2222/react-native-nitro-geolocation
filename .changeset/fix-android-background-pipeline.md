---
"react-native-nitro-geolocation": patch
---

Repair and harden the Android background location pipeline, plus iOS parity fixes.

- Android delivery: make the fused callback `PendingIntent` mutable so the OS dispatches location updates; start the foreground service with an explicit `location` type and handle start failures; guard headless task dispatch against background-start rejection; report `RUNNING` only after updates register; stop swallowing service-startup and per-listener failures and surface them via `lastError`.
- Android hardening: run HTTP sync on a shared executor instead of a thread per location, with exponential backoff + jitter and connection draining; enable WAL on the store; isolate background event listeners so one failure does not drop the rest; run boot-resume off the broadcast main thread; add tagged logging.
- Store cap contract (`maxStoredLocations` / `maxStoredEvents`), applied consistently on Android and iOS:
  - unset → use the native default safety cap
  - `0` or negative → unbounded storage
  - positive value → explicit cap
- iOS parity: ignore transient `kCLErrorLocationUnknown` in the background delegate.
