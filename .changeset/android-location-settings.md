---
"react-native-nitro-geolocation": minor
---

Add Android provider/settings APIs to the Modern API: `hasServicesEnabled()`, `getProviderStatus()`, and `requestLocationSettings(options?)`. Android now checks native provider state and uses Google Play Services `SettingsClient` to show the system settings resolution dialog when high-accuracy location requirements are not satisfied.
