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
  the device by default unless the app sets `persist: false`. The app controls
  storage caps and can clear retained records.
- Native HTTP sync runs only when the app supplies `sync.url`. It sends the
  configured location payload to that app-selected URL, never to a project
  endpoint.
- Geocoding uses the operating system geocoder. Its implementation may contact
  Apple, Google, or another platform service under the device's platform terms.
- Native prebuilt binaries may be downloaded from this project's GitHub
  Releases during the native build. This build-time request contains no app
  user's location data and can be disabled with
  `NITRO_GEOLOCATION_USE_PREBUILT=0`.

## Reporting

Report a suspected security or privacy issue privately through the repository's
[security advisory form](https://github.com/jingjing2222/react-native-nitro-geolocation/security/advisories/new).
