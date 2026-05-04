---
"react-native-nitro-geolocation": minor
"@react-native-nitro-geolocation/rozenite-plugin": minor
---

Add optional `mocked` and `provider` metadata to root location responses with Android and iOS native mappings.
Add `GeolocationConfiguration` as the preferred root API configuration type while preserving `ModernGeolocationConfiguration` as a deprecated compatibility alias.
Keep the Compat API response shape unchanged for the drop-in replacement contract.
Normalize missing native coordinate values to explicit `null` unions and include the same metadata in Rozenite DevTools mock responses.
