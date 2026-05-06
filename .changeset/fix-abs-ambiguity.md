---
"react-native-nitro-geolocation": patch
---

Fix iOS build error caused by ambiguous `abs` overload in `angularDistance`. Qualify with `Swift.abs(...)` so the compiler picks the generic signed-numeric overload instead of conflicting with Foundation's `fabs`.
