---
"react-native-nitro-geolocation": patch
---

Add experimental React Native 0.87 Swift Package Manager support through a
checksum-verified binary package containing matching Nitro Modules and Nitro
Geolocation XCFrameworks, an autolinking plugin, and a consumer configuration
helper. Release validation now builds the package and links Debug and Release
RN 0.87 consumers before the artifact can gate a `latest` promotion.
