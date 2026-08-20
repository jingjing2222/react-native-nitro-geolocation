# GPS-only and offline verification

GPS-only routing and offline operation are related but different contracts:

- **GPS-only result acceptance** means Android's platform location manager is
  selected and the app accepts only a result whose provider is `gps`. The
  native high-accuracy route prefers GPS but may try the network provider when
  GPS cannot serve the request; the recipe detects and rejects that fallback.
- **Offline** describes the device environment. The app cannot infer that
  Wi-Fi and mobile data are truly unavailable from geolocation provider status,
  so verify it outside the app.

This recipe is intentionally explicit. It does not install a hidden provider
policy or retry after a timeout. It makes any native fallback visible instead
of accepting it as a GPS result.

## Android recipe

Request `ACCESS_FINE_LOCATION`, keep Android location services enabled, and
configure the Android platform provider once during app startup:

```ts
import {
  getCurrentPosition,
  getAccuracyAuthorization,
  requestPermission,
  setConfiguration
} from 'react-native-nitro-geolocation';

setConfiguration({
  locationProvider: 'android'
});

export async function getFreshGpsPosition() {
  const permission = await requestPermission();
  const accuracyAuthorization = await getAccuracyAuthorization();
  if (permission !== 'granted' || accuracyAuthorization !== 'full') {
    throw new Error('Precise location permission is required');
  }

  const position = await getCurrentPosition({
    accuracy: { android: 'high' },
    granularity: 'fine',
    maximumAge: 0,
    maxUpdateAge: 0,
    maxUpdateDelay: 0,
    timeout: 45_000
  });

  if (position.provider !== 'gps') {
    throw new Error(
      `Expected the GPS provider, received ${position.provider ?? 'unknown'}`
    );
  }

  return position;
}
```

`maximumAge: 0` and `maxUpdateAge: 0` prevent an accepted cached fix. A long
timeout is still normal for the first satellite fix, especially after reboot,
travel, or a long period indoors. The Android platform route can try a network
provider if GPS fails; the response assertion turns that into an explicit
application error. Decide whether to show a retry action in your product, but
do not silently accept or retry another provider when the feature requires a
GPS result.

Before calling the recipe, `getProviderStatus()` can report whether Android
location services and the GPS provider are available. `networkAvailable` is the
Android network *location provider*, not proof that the device has internet
connectivity.

Android reports coarse-only access as granted, so also require
`getAccuracyAuthorization() === 'full'`. If it returns `reduced`, send the user
to the app's system settings with React Native's `Linking.openSettings()` and
let them opt into precise location; calling `requestPermission()` again is not
an upgrade path after coarse access is already granted.

## iOS boundary

iOS Core Location does not expose a public sensor-selection API. You can test
that an iOS feature works without connectivity, but you cannot truthfully label
the request GPS-only or assert an iOS `provider` value of `gps`. Keep the normal
`locationProvider: 'auto'` configuration on iOS.

## Verification matrix

Run the same product action in every required environment. Record the device,
OS, permission scope, sky conditions, elapsed time, returned provider, mock
flag, and outcome.

| Case | Environment | Expected result | Automation role |
| --- | --- | --- | --- |
| Android route | Emulator, location services on, injected fix | Fresh accepted result with `provider=gps` and `mocked=true` | Required E2E; proves routing and response checks, not satellites |
| Android no services | Emulator, master location switch off | Readiness reports services/GPS unavailable and request stays blocked | Required edge-case E2E |
| Android online | Physical device outdoors, precise permission, network on | Fresh non-mocked `gps` result | Manual baseline |
| Android offline | Same physical device, Wi-Fi and mobile data off, location services on | Fresh non-mocked `gps` result or an explicit timeout | Required manual offline proof |
| Android approximate only | Emulator or physical device, precise permission denied | Readiness reports `accuracy=reduced`, blocks the request, and opens app settings for remediation | Required E2E and manual permission edge case |
| Android GPS unavailable | Physical device, GPS/location services off | Readiness blocks the request | Manual provider edge case |
| Android cold start | Physical device offline after reboot or long idle, clear sky | `gps` result within the product timeout or an explicit timeout | Manual latency boundary |
| iOS offline | Physical iPhone, connectivity off | Core Location result or explicit error/timeout; no source assertion | Manual platform boundary |

An emulator result cannot replace the physical offline row: Maestro location
injection is mocked. A physical result is valid only when `mocked=false` and the
device network state was checked independently.

## Repository verification kit

Build and install the Release example before running these commands from the
repository root.

The normal Android suite includes the injected GPS route and the
location-services-disabled edge case:

```bash
yarn workspace react-native-nitro-geolocation-example test:e2e:android
```

Start the emulator with validated internet access. The dedicated command first
verifies that online baseline, temporarily disables Wi-Fi and mobile data, runs
the injected provider-routing flow, and restores both on exit. It intentionally
rejects an emulator that starts offline or behind an unvalidated/captive route
because it could not prove the disconnect-and-restore transition:

```bash
yarn workspace react-native-nitro-geolocation-example \
  test:e2e:gps-offline:android
```

For a physical satellite proof, disable Wi-Fi and mobile data yourself, keep
location services enabled, move outdoors, then acknowledge the prepared state:

```bash
GPS_OFFLINE_NETWORK_PREPARED=1 \
ANDROID_SERIAL=<device-serial> \
yarn workspace react-native-nitro-geolocation-example \
  test:e2e:gps-offline:android
```

The physical flow does not mutate connectivity. It rejects a result unless the
provider is `gps` and `mocked` is `false`.

The example page is available at
`nitrogeolocation://app/gps-offline-recipe`. Use it for Android manual matrix
runs and capture its readiness and result cards with the environment notes
above. The page intentionally reports iOS as unsupported because Core Location
does not expose sensor routing; exercise the iOS offline row through the normal
current-position screen or your product flow and record the result without a
source assertion.
