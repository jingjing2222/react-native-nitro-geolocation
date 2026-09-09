---
"react-native-nitro-geolocation": minor
---

Include app authorization scope in native provider status snapshots and events. `watchProviderStatus()` now reports permission-only changes, including iOS Always/WhenInUse transitions and Android location app-op changes, with existing token-based cleanup.
