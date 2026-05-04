---
"react-native-nitro-geolocation": major
"@react-native-nitro-geolocation/rozenite-plugin": major
---

Rename the root API configuration type from `ModernGeolocationConfiguration` to `GeolocationConfiguration`.
Add optional `mocked` and `provider` metadata to root location responses with Android and iOS native mappings.
Keep the Compat API response shape unchanged for the drop-in replacement contract.
Normalize missing native coordinate values to explicit `null` unions and include the same metadata in Rozenite DevTools mock responses.
Configure the v2 release line for Changesets prereleases on the `next` dist-tag, with `baseBranch` set to `v2` until v2 is promoted back to the main release line.
