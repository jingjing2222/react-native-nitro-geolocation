---
"react-native-nitro-geolocation": patch
---

Apply iOS background location configuration when the location manager is created or configuration changes, including when permission was granted previously or by another library. Explicitly disabling or omitting the option restores foreground-only updates, and the location background mode remains required.
