# Privacy Statement

`react-native-nitro-geolocation` is a library, not a hosted location service.
The project does not operate a telemetry endpoint, create advertising IDs, sell
location data, or automatically send app or device data to the maintainers.

The app integrating the library remains the data controller. It decides when
to request permission, when to start location APIs, whether to persist
background records, and whether to configure a destination for native HTTP
sync. Review the complete [privacy and compliance guide](https://react-native-nitro-geolocation.pages.dev/guide/privacy-compliance)
before shipping.

## Data flows

- Foreground location, heading, provider, and lifecycle results stay between
  the platform location service and the app unless the app sends them onward.
- Background location is opt-in. A started background session stores records on
  the device by default unless the app sets `persist: false`. Configuration and
  geofences remain persisted independently until the app removes them or calls
  `resetBackgroundLocation()`. App-private storage can participate in OS backup
  unless the integrating app excludes it.
- Native HTTP sync runs only when the app supplies `sync.url`. It sends the
  configured location payload to that app-selected URL, never to a project
  endpoint.
- Geocoding uses the operating system geocoder. Its implementation may contact
  Apple, Google, or another platform service under the device's platform terms.
- Android debug builds log exact background coordinates to logcat by default;
  release builds disable verbose logs by default. Treat collected debug logs as
  precise-location data.
- Native prebuilt binaries may be downloaded from this project's GitHub
  Releases during the native build. This build-time request contains no app
  user's location data and can be disabled with
  `NITRO_GEOLOCATION_USE_PREBUILT=0`.

The iOS SDK ships its own privacy manifest declaring its app-private
`UserDefaults` access and the opt-in sync feature's linked precise-location
collection for app functionality, with tracking disabled. Consumer apps still
need to audit the final Xcode privacy report and maintain declarations for their
own code and other dependencies.

## Reporting

Report a suspected security or privacy issue privately through the repository's
[security advisory form](https://github.com/jingjing2222/react-native-nitro-geolocation/security/advisories/new).
