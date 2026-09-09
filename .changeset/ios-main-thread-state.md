---
"react-native-nitro-geolocation": patch
---

Keep the location manager property read on the main thread when checking accuracy authorization, closing a remaining race with first-launch initialization. Add a tested patch-package backport for apps that must stay on 1.4.3.
