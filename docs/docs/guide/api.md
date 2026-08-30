---
title: API
---

> Simple functional API with direct calls and minimal abstractions

This API provides a straightforward approach to geolocation with direct function calls and a single hook for continuous tracking.

## Find an API by task

| Task | Start at |
| --- | --- |
| Configure providers and authorization | [Configuration](#configuration) |
| Inspect or request permission | [Permission Functions](#permission-functions) |
| Diagnose whether location can run | [Android Provider and Settings](#android-provider-and-settings) |
| Read a fresh or cached position | [Location Functions](#location-functions) |
| Watch position in a component | [React Hook](#react-hook) |
| Own a watch outside React | [Low-level Functions](#low-level-functions-advanced) |
| Handle location errors | [Error handling](#error-handling) |
| Import TypeScript types | [TypeScript Support](#typescript-support) |
| Move from `/compat` | [Migration from Compat](#migration-from-compat) |

For a 1.x application, complete [Upgrade from 1.x](./upgrade-from-v1.md) first;
the API reference is not a complete breaking-change checklist.

## Design Philosophy

**Simple and Direct**:

- **Direct function calls**: No complex abstractions or classes
- **Single hook**: Only `useWatchPosition` for continuous tracking
- **No Provider required**: Just call functions directly
- **Automatic cleanup**: Hook handles subscription lifecycle

**Core Principles**:

- **Simple configuration**: Call `setConfiguration()` once at app startup
- **Direct function calls**: Use `getCurrentPosition()`, `requestPermission()` etc.
- **One hook for tracking**: `useWatchPosition` for continuous updates
- **Type-safe**: Full TypeScript support
- **Battery efficient**: Native subscriptions stop immediately when disabled

## Configuration

Set global configuration once at app startup.

### setConfiguration()

```tsx
import { setConfiguration } from 'react-native-nitro-geolocation';

// In App.tsx or index.js
setConfiguration({
  authorizationLevel: 'whenInUse',
  enableBackgroundLocationUpdates: false,
  locationProvider: 'auto'
});
```

**Options**:

- `autoRequestPermission?: boolean` - Deprecated compatibility option. `setConfiguration()` does not request permission; call `requestPermission()` explicitly when the app is ready to show the native prompt.
- `authorizationLevel?: 'whenInUse' | 'always' | 'auto'` - iOS: Authorization level
- `enableBackgroundLocationUpdates?: boolean` - iOS: Enable background location
- `locationProvider?: 'playServices' | 'android' | 'auto'` - Android: `auto` and `playServices` prefer Google Play Services fused location when available and fall back to Android's platform provider. `android` forces the platform `LocationManager` path.

**Type**:

```typescript
export type GeolocationConfiguration = {
  /** @deprecated Call `requestPermission()` explicitly. */
  autoRequestPermission?: boolean;
  authorizationLevel?: 'always' | 'whenInUse' | 'auto';
  enableBackgroundLocationUpdates?: boolean;
  /** `auto` and `playServices` prefer fused, then platform fallback. */
  locationProvider?: 'playServices' | 'android' | 'auto';
};
```

**When to call**:

- Once at app startup (e.g., in `App.tsx` or `index.js`)
- Before making any location requests

**Web behavior**:

- Browser builds resolve the main package import to a web entry that uses
  `navigator.geolocation`.
- `setConfiguration()` is a no-op on web. Browser permission prompts are driven
  by `getCurrentPosition()` / `watchPosition()`, not by a standalone platform
  request API.
- `authorizationLevel`, `enableBackgroundLocationUpdates`, and
  `locationProvider` are ignored on web.

## Permission Functions

### checkPermission()

Check current location permission status without requesting it.

```tsx
import { checkPermission } from 'react-native-nitro-geolocation';

async function checkLocationPermission() {
  const status = await checkPermission();
  console.log('Permission status:', status);
  // status: 'granted' | 'denied' | 'restricted' | 'undetermined'
}
```

**Returns**: `Promise<PermissionStatus>`

**Permission Status**:

- `'granted'` - User granted location permission
- `'denied'` - User denied permission
- `'restricted'` - Permission restricted (iOS parental controls)
- `'undetermined'` - Permission not yet requested

### getPermissionDetails()

Read the current foreground status, granted scope, accuracy authorization, and
the next appropriate permission action without showing a prompt, opening
settings, or acquiring a location.

```tsx
import { getPermissionDetails } from 'react-native-nitro-geolocation';

async function prepareLocationPermission() {
  const details = await getPermissionDetails();

  if (details.settingsGuidance === 'requestPermission') {
    // Show your in-app rationale before calling requestPermission().
  } else if (details.settingsGuidance === 'reviewSettings') {
    // Explain why the user may want to review the app's system settings.
  }

  return details;
}
```

**Returns**: `Promise<PermissionDetails>`

```typescript
interface PermissionDetails {
  status: PermissionStatus;
  scope: 'none' | 'foreground' | 'background';
  accuracy: 'full' | 'reduced' | 'unknown';
  canAskAgain: boolean | null;
  settingsGuidance:
    | 'none'
    | 'requestPermission'
    | 'requestPermissionOrReviewSettings'
    | 'reviewSettings'
    | 'managedRestriction'
    | 'useSupportedEnvironment';
}
```

- `scope` is `background` only when both foreground and background access are
  granted. Browser access is always `foreground`.
- `accuracy` reports iOS precise/reduced and Android fine/approximate access.
  Browsers do not expose this distinction and return `unknown`.
- `canAskAgain` describes whether another **foreground** system permission
  prompt is known to be possible. It does not describe a later background
  permission upgrade. `null` means the platform cannot determine the answer
  without attempting a request.
- Android exposes the same denied state before the first request and after
  permanent denial through this read-only API. In that ambiguous state,
  `canAskAgain` is `null` and `settingsGuidance` is
  `requestPermissionOrReviewSettings`. After a normal denial, Android's
  permission-rationale signal makes the state known requestable, so
  `canAskAgain` is `true` and guidance is `requestPermission`.
- iOS returns `requestPermission` for `undetermined`, `reviewSettings` for
  `denied`, and `managedRestriction` for `restricted`.
- Web uses the Permissions API when available. Without it, a successful
  position/watch callback or permission-denied error is used as bounded
  evidence for at most 30 seconds. A denial proves the current state but not
  whether the browser will prompt again, so `canAskAgain` remains `null` and
  guidance is `requestPermissionOrReviewSettings`. An authoritative
  Permissions API `denied` state instead returns `false` and `reviewSettings`.
  Without observed evidence, foreground prompt capability is also unknown. Without
  `navigator.geolocation`, guidance is
  `useSupportedEnvironment`.


### requestPermission()

Request location permission from the user.

```tsx
import { useState } from 'react';
import { Button, Text, View } from 'react-native';
import { requestPermission } from 'react-native-nitro-geolocation';

function PermissionButton() {
  const [status, setStatus] = useState<string>('unknown');
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    setLoading(true);
    try {
      const result = await requestPermission();
      setStatus(result);
      if (result === 'granted') {
        console.log('Permission granted!');
      }
    } catch (err) {
      console.error('Permission error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <Button
        onPress={handlePress}
        disabled={loading}
        title={loading ? 'Requesting...' : 'Enable Location'}
      />
      <Text>Status: {status}</Text>
    </View>
  );
}
```

**Returns**: `Promise<PermissionStatus>`

**Behavior**:

- Shows system permission dialog if `undetermined`
- Returns immediately if already `granted` or `denied`
- On iOS, uses `authorizationLevel` from configuration
- On web, triggers the browser prompt by making a one-shot
  `navigator.geolocation.getCurrentPosition()` call, then returns the mapped
  browser permission state.


## Location Functions

### Android Provider and Settings

The provider/settings snapshot helpers introduced before 2.0 remain available.
`watchProviderStatus()` and the deterministic settings result are available in
2.0.

Use these helpers before user-facing precise-location flows where the app needs
to know whether Android device settings can satisfy the request.

```tsx
import { useEffect } from 'react';
import {
  getCurrentPosition,
  getLocationAvailability,
  getLocationReadiness,
  getProviderStatus,
  hasServicesEnabled,
  requestLocationSettings,
  requestLocationSettingsDetailed,
  unwatch,
  watchProviderStatus
} from 'react-native-nitro-geolocation';

async function inspectLocation() {
  const readiness = await getLocationReadiness();
  // Show app-owned actions for every remediation, including acquirePosition
  // when the device is ready but the module cache is still cold.
  // The diagnosis itself never prompts or opens settings.
  return readiness.remediations;
}

async function prepareAccurateLocation() {
  const availability = await getLocationAvailability();
  const servicesEnabled = await hasServicesEnabled();
  const providerStatus = await getProviderStatus();

  if (!availability.available || !servicesEnabled || providerStatus.googleLocationAccuracyEnabled === false) {
    const settings = await requestLocationSettingsDetailed({
      accuracy: { android: 'high' },
      interval: 5000,
      fastestInterval: 1000
    });
    if (settings.outcome !== 'satisfied') return settings;
  }

  return getCurrentPosition({
    accuracy: { android: 'high', ios: 'best' },
    timeout: 15000
  });
}

function ProviderStatusObserver() {
  useEffect(() => {
    const providerToken = watchProviderStatus((status) => {
      console.log('Location services:', status.locationServicesEnabled);
    });

    return () => unwatch(providerToken);
  }, []);

  return null;
}
```

**Functions**:

- `hasServicesEnabled(): Promise<boolean>` - Checks whether device-level
  location services are enabled.
- `getProviderStatus(): Promise<LocationProviderStatus>` - Returns provider
  state such as `locationServicesEnabled`, `gpsAvailable`,
  `networkAvailable`, `passiveAvailable`, Android Google Play Services
  availability, and Google Location Accuracy when Google Play Services exposes
  it.
- `watchProviderStatus(callback): string` - Delivers an asynchronous initial
  provider snapshot and then only distinct readiness changes. Pass its token to
  `unwatch()` for cleanup. Available in 2.0.
- `getLocationAvailability(): Promise<LocationAvailability>` -
  Available since `v1.2`. Android reads Fused Location availability when
  `locationProvider: 'auto'` or `locationProvider: 'playServices'` is
  configured, then falls back to platform provider/service checks. iOS maps Core
  Location service and authorization state. When unavailable, `reason` is a
  typed `LocationAvailabilityReason` code rather than platform-specific text.
- `getLocationReadiness(): Promise<LocationReadiness>` - Combines current
  permission, services, provider, availability, Play Services, Google Location
  Accuracy, and observed module-cache state into one read-only diagnosis. It
  returns stable remediation codes such as `requestPermission`,
  `requestPermissionOrReviewSettings`, `enableLocationServices`,
  `useSupportedEnvironment`, and `acquirePosition`; it never requests
  permission, opens settings, starts location acquisition, or changes
  configuration. On Web, `useSupportedEnvironment` means reopening the app in
  a secure context and a browser or WebView that exposes the Geolocation API.
  When the Permissions API cannot report state, Web treats a successful
  position observation as best-effort granted evidence for at most 30 seconds;
  a denial, missing Geolocation API, clock rollback, or expiry clears that
  inference.
  Android uses `requestPermissionOrReviewSettings` because its existing
  permission status cannot distinguish a first request from permanent denial;
  request permission first, then offer app settings if it remains denied.
  Google Play Services remediations are returned only when
  `locationProvider: 'playServices'` is explicitly configured; the default
  `auto` and `android` routes can continue through Android platform providers.
- `requestLocationSettingsDetailed(options?): Promise<LocationSettingsResult>` -
  Checks the requested Android location settings and shows Android's native
  resolution dialog when available. Expected outcomes resolve as `satisfied`,
  `cancelled`, `unavailable`, or `activityMissing`, together with the latest
  provider status. Request failures such as a concurrent request still reject.
- `requestLocationSettings(options?): Promise<LocationSettingsResult>` - The
  2.0 method returns the same deterministic result. The detailed name is
  provided to make result handling explicit in code shared across release lines.

Both settings methods are Android-focused. On iOS they resolve with the current
Core Location service status and do not show a settings dialog.

`watchProviderStatus()` only observes readiness: it does not request permission,
open settings, or start position updates. Android reacts to system provider and
location-mode broadcasts. iOS rechecks after authorization changes and when the
app becomes active, which covers returning from Settings. Browser builds recheck
when the page becomes visible or active. Provider-specific optional fields stay
`undefined` on platforms that cannot report them.

### Android Reliability Notes

- `locationProvider: 'auto'` and `locationProvider: 'playServices'` prefer
  Google Play Services fused location when available and fall back to Android's
  platform provider.
- `locationProvider: 'android'` forces Android's platform `LocationManager`
  path.
- Approximate/coarse location flows are supported through permissions and
  Android `granularity`.
- Use `getLastKnownPosition()` for a synchronous read of the module cache. Use
  `getLastKnownPositionAsync()` to query native/provider caches without starting
  a fresh request.
- Errors include `PLAY_SERVICE_NOT_AVAILABLE`,
  `SETTINGS_NOT_SATISFIED`, and `TIMEOUT`.

### Web Notes

Web support uses the browser standard `navigator.geolocation` API.
It requires a secure context (`https://`, `localhost`, or another browser-trusted
origin). Unsupported browsers or unavailable providers reject location requests
with `POSITION_UNAVAILABLE`.

Supported on web:

- `checkPermission()` maps `navigator.permissions.query({ name:
  'geolocation' })` to `granted`, `denied`, or `undetermined` when the
  Permissions API is available.
- `getPermissionDetails()` enriches that read-only state with foreground scope
  and settings guidance. Browser accuracy authorization remains `unknown`.
- `requestPermission()` performs a one-shot browser geolocation request because
  browsers do not expose a standalone geolocation permission request API.
- `getCurrentPosition()` uses `navigator.geolocation.getCurrentPosition()` for
  ordinary requests. When `signal` is provided, it uses a one-shot browser
  watch so aborting can call `clearWatch()` immediately.
- `watchPosition()` wraps `navigator.geolocation.watchPosition()` and returns a
  string token.
- `watchProviderStatus()` reports whether browser geolocation is available and
  rechecks on page visibility/focus lifecycle events.
- `unwatch()` and `stopObserving()` clear position and provider-status watches.

Web option behavior:

- `accuracy` maps to the browser's high-accuracy boolean. `timeout` and
  `maximumAge` are forwarded to the browser.
- `distanceFilter` is applied in JavaScript for watch updates after the first
  emitted position.
- `authorizationLevel`, `enableBackgroundLocationUpdates`, `locationProvider`,
  `interval`, `fastestInterval`, `useSignificantChanges`, Android granularity
  options, and iOS tuning options are ignored because browsers do not provide
  matching controls.
- Geocoding, heading, Android settings, and temporary full-accuracy APIs are
  native-focused. On web, provider/status helpers return browser availability
  where possible; unsupported sensor/geocoder calls reject with
  `POSITION_UNAVAILABLE`.

### getCurrentPosition()

Get current location (one-time request).

```tsx
import { useState } from 'react';
import { Button, Text, View } from 'react-native';
import {
  getCurrentPosition,
  type GeolocationResponse
} from 'react-native-nitro-geolocation';

function LocationButton() {
  const [position, setPosition] = useState<GeolocationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePress = async () => {
    setLoading(true);
    setError(null);
    try {
      const pos = await getCurrentPosition({
        accuracy: { android: 'high', ios: 'best' },
        timeout: 15000
      });
      setPosition(pos);
    } catch (err: any) {
      setError(err?.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <Button
        onPress={handlePress}
        disabled={loading}
        title={loading ? 'Loading...' : 'Get Location'}
      />
      {error && <Text style={{ color: 'red' }}>Error: {error}</Text>}
      {position && (
        <View>
          <Text>Lat: {position.coords.latitude}</Text>
          <Text>Lng: {position.coords.longitude}</Text>
          <Text>Accuracy: {position.coords.accuracy}m</Text>
        </View>
      )}
    </View>
  );
}
```

**Parameters**: `options?: CurrentPositionOptions`

**Options**:

- `timeout?: number` - Request timeout in ms (default: 600000 / 10 min)
- `maximumAge?: number` - Max age of cached location in ms (default: 0)
- `signal?: AbortSignal` - Cancels only this request. A signal that is already
  aborted prevents native or browser location work from starting. The promise
  rejects with the exact `signal.reason`; runtimes without a reason receive an
  `AbortError` fallback.
- `accuracy?: { android?: 'high' | 'balanced' | 'low' | 'passive'; ios?: 'bestForNavigation' | 'best' | 'nearestTenMeters' | 'hundredMeters' | 'kilometer' | 'threeKilometers' | 'reduced' }` - Platform-specific accuracy preset. 2.0 callers use this option; `enableHighAccuracy` remains only on `/compat`.
- `granularity?: 'permission' | 'coarse' | 'fine'` - Android-only request granularity, available since `v1.2`. `permission` follows the granted permission level, `coarse` avoids fine GPS-only requests, and `fine` requires fine location permission.
- `waitForAccurateLocation?: boolean` - Android-only Fused request tuning, available since `v1.2`.
- `maxUpdateAge?: number` - Android-only maximum age for an initial update in ms, available since `v1.2`.
- `maxUpdateDelay?: number` - Android-only maximum batching delay in ms, available since `v1.2`.
- `activityType?: 'other' | 'automotiveNavigation' | 'fitness' | 'otherNavigation' | 'airborne'` - iOS Core Location activity type, available since `v1.2`.
- `pausesLocationUpdatesAutomatically?: boolean` - iOS automatic pause behavior, available since `v1.2`.
- `showsBackgroundLocationIndicator?: boolean` - iOS background location indicator, available since `v1.2`. This only has a visible effect when the app has background location capability and permission.

Use `accuracy` when you need explicit platform-native behavior:

```tsx
await getCurrentPosition({
  accuracy: {
    android: 'high',
    ios: 'bestForNavigation'
  },
  granularity: 'permission',
  waitForAccurateLocation: true,
  timeout: 15000
});
```

Use an `AbortController` when the screen or operation that owns a one-shot
request can end before location arrives:

```tsx
const controller = new AbortController();

const request = getCurrentPosition({
  accuracy: { android: 'high', ios: 'best' },
  maximumAge: 0,
  timeout: 30000,
  signal: controller.signal
});

controller.abort(new Error('Screen closed'));
await request;
```

Cancellation is isolated by request ID: aborting one concurrent request does
not cancel another request or an active watch. Omitting `signal` keeps the
existing one-shot native/browser path. The callback-based `/compat` API is
unchanged.

Android maps the presets to native accuracy/priority intent. With `auto` or
`playServices`, requests prefer Google Play Services fused location and use the
matching fused priority before platform fallback. With `android`, requests stay
on `LocationManager`: `high` prefers GPS with a network fallback, `balanced`
uses the network provider, `low` uses network/passive providers, and `passive`
only listens through the passive provider. iOS maps the presets to Core
Location `desiredAccuracy` constants.

iOS tuning options are applied to both one-time requests and watches through
the shared Core Location manager configuration:

```tsx
await getCurrentPosition({
  accuracy: { ios: 'kilometer' },
  activityType: 'fitness',
  pausesLocationUpdatesAutomatically: false,
  showsBackgroundLocationIndicator: false,
  timeout: 15000
});
```

Use `showsBackgroundLocationIndicator` only after configuring background
location in the app target, including the `location` background mode and the
required Info.plist location usage descriptions.

**Returns**: `Promise<GeolocationResponse>`

**Response**:

```typescript
export type LocationProviderUsed =
  | 'fused'
  | 'gps'
  | 'network'
  | 'passive'
  | 'unknown';

type LocationResponseSource =
  | 'currentPosition'
  | 'watchPosition'
  | 'platformCache'
  | 'moduleCache';

type LocationQualityBand = 'high' | 'medium' | 'low' | 'unknown';

interface LocationMetadata {
  source: LocationResponseSource;
  age?: number;
  quality: LocationQualityBand;
  staleReason?:
    | 'maximumAgeExceeded'
    | 'futureTimestamp'
    | 'invalidTimestamp';
}

interface GeolocationResponse {
  coords: {
    latitude: number;
    longitude: number;
    altitude: number | null;
    accuracy: number;
    altitudeAccuracy: number | null;
    heading: number | null;
    speed: number | null;
  };
  timestamp: number;
  mocked?: boolean;
  provider?: LocationProviderUsed;
  metadata?: LocationMetadata;
}
```

### Mock and provider metadata

`mocked` and `provider` are optional response metadata fields added in v1.2.
They describe the source of that particular position sample:

- `mocked` reports whether the sample source identified it as simulated or
  supplied by a test provider. Native Android responses use `Location.isMock`
  (or `isFromMockProvider` on older Android versions). Native iOS responses use
  `CLLocation.sourceInformation` when it is available on iOS 15 and later;
  otherwise the field can be absent.
- `provider` identifies the Android provider route as `fused`, `gps`,
  `network`, or `passive`. iOS and web return `unknown` because those platforms
  do not expose an equivalent provider name through this API.
- Web positions omit `mocked` because the browser Geolocation API does not
  expose trustworthy simulation metadata.
- The optional development-tools integration returns `mocked: true` for its
  injected JavaScript samples. That value identifies the tooling source; it is
  not native platform attestation.

Treat `mocked` as per-sample diagnostic evidence, not as an anti-fraud or
device-integrity guarantee. A missing value means the platform did not expose
the signal; it does not mean `false`. Likewise, `provider` describes the route
used for the sample and does not establish whether the coordinates should be
trusted.

The synchronous module cache returned by `getLastKnownPosition()` preserves
the metadata attached to the last position observed by this JavaScript module.
Disabling a mock-location app or simulator fixture cannot rewrite that cached
response, so it may still contain `mocked: true`. By contrast,
`getLastKnownPositionAsync()` converts a native cached sample when it is read
on Android or iOS; platform metadata is derived again and Android `provider`
can reflect the current query route. On web it filters the JavaScript module
cache, while the optional development-tools integration filters its configured
mock cache. Do not require an asynchronous native-cache response to be
identical to an earlier JavaScript response. Request or observe a newer sample
when application policy requires fresher evidence, and apply `maximumAge` when
reading the platform cache.

The `/compat` entry point keeps the
`@react-native-community/geolocation` response shape and does not include these
fields. Compat callers can opt into equivalent metadata by setting
`includeExtraMetadata: true` on compat `getCurrentPosition()` / `watchPosition()` calls.

#### Testing the signal naturally

- Test `mocked: true` with an emulator or simulator location fixture such as
  Maestro `setLocation`.
- Test `mocked: false` only on a physical device receiving a real provider
  location, without coordinate injection. Do not manufacture the false branch
  by changing or hiding returned metadata.
- Assert absence separately on platforms that cannot provide the signal; do
  not convert an unavailable value to `false`.

### Error handling

```tsx
import {
  LocationErrorCodes,
  watchPosition,
  unwatch,
} from 'react-native-nitro-geolocation';

const token = watchPosition(
  (position) => {
    console.log(position.coords.latitude, position.coords.longitude);
  },
  (error) => {
    if (error.code === LocationErrorCodes.SETTINGS_NOT_SATISFIED) {
      // Device/provider settings do not satisfy the request.
    }
    // error.message: Human-readable error
  }
);

unwatch(token);
```

Starting in 2.0, API errors use readable string discriminants. Keep
comparisons against the `LocationErrorCodes` members shown below instead of
copying their values. The additional native setup/provider members
(`INTERNAL_ERROR`, `PLAY_SERVICE_NOT_AVAILABLE`, and
`SETTINGS_NOT_SATISFIED`) were originally added in v1.2; 2.0 keeps those member
names while replacing every previous numeric value with a string.

The code is committed by the native layer before a `LocationError` is sent to
JS. Both `watchPosition` error callbacks and public Promise rejections from
`getCurrentPosition`/`requestPermission` receive the same `{ code, message }`
shape; JS only relays that object and does not parse or reclassify native
messages.

| Value | Name                         | Meaning                                      |
| ----- | ---------------------------- | -------------------------------------------- |
| `internalError` | `INTERNAL_ERROR` | Unexpected module/native failure |
| `permissionDenied` | `PERMISSION_DENIED` | Location permission was denied |
| `positionUnavailable` | `POSITION_UNAVAILABLE` | A position fix is unavailable |
| `timeout` | `TIMEOUT` | The request timed out |
| `playServicesUnavailable` | `PLAY_SERVICE_NOT_AVAILABLE` | Android Google Play Services is unavailable |
| `settingsNotSatisfied` | `SETTINGS_NOT_SATISFIED` | Device/provider settings do not satisfy the request |

The `/compat` API keeps the legacy numeric browser-style contract with only
`PERMISSION_DENIED` (`1`), `POSITION_UNAVAILABLE` (`2`), and `TIMEOUT` (`3`).
See [2.0 Error Migration](./v2-error-migration.md) for the 1.x-to-2.x mapping.

### getLastKnownPosition() and getLastKnownPositionAsync()

`getLastKnownPosition()` synchronously reads the latest position observed by
this JavaScript module. It takes no options, never calls native code, and returns
`undefined` while that module-local cache is cold.

```tsx
import {
  getLastKnownPosition,
  getLastKnownPositionAsync
} from 'react-native-nitro-geolocation';

const observed = getLastKnownPosition();

const cached = await getLastKnownPositionAsync({
  maximumAge: 60_000,
  accuracy: { android: 'balanced', ios: 'hundredMeters' }
});
```

`getLastKnownPositionAsync(options?: LastKnownPositionOptions)` queries
native/provider cache-only sources using `maximumAge`, `accuracy`,
`granularity`, `waitForAccurateLocation`, and `maxUpdateAge`. Fresh/watch-only
options are intentionally excluded, and the call never falls through to a
fresh request. It resolves `undefined` when no cached location
satisfies the options, including a native `POSITION_UNAVAILABLE` result. Other
failures, such as permission denial, reject with `LocationError`
contract.

### Geocoding APIs

Available since `v1.2`.

Use `geocode()` to convert a human-readable address into candidate coordinates,
and `reverseGeocode()` to convert coordinates into candidate address fields.
Both APIs use the platform geocoder, so result quality, language, network
behavior, and availability can differ between Android `Geocoder` and iOS
`CLGeocoder`.

```tsx
import {
  geocode,
  reverseGeocode
} from 'react-native-nitro-geolocation';

const locations = await geocode('City Hall, Seoul, South Korea');
// locations: Array<{ latitude: number; longitude: number; accuracy?: number }>

const addresses = await reverseGeocode({
  latitude: 37.5665,
  longitude: 126.978
});
// addresses: Array<{
//   country?: string;
//   region?: string;
//   city?: string;
//   district?: string;
//   street?: string;
//   postalCode?: string;
//   formattedAddress?: string;
// }>
```

`geocode(address)` rejects with `INTERNAL_ERROR` when `address` is blank.
`reverseGeocode(coords)` rejects with `INTERNAL_ERROR` when latitude or
longitude is non-finite or outside the valid coordinate range. Platform
geocoder service failures reject with the same `{ code, message }`
`LocationError` shape as the rest of the API.

### Heading APIs

Available since `v1.2`.

Use `getHeading()` for a single compass heading and `watchHeading()` for
continuous heading updates. Stop heading watches with the same `unwatch(token)`
API used by `watchPosition()`.

```tsx
import { getHeading, watchHeading, unwatch } from 'react-native-nitro-geolocation';

const heading = await getHeading();

const token = watchHeading(
  (nextHeading) => {
    console.log(nextHeading.magneticHeading);
  },
  (error) => {
    console.error(error.message);
  },
  { headingFilter: 5 }
);

unwatch(token);
```

```typescript
type Heading = {
  magneticHeading: number;
  trueHeading?: number;
  accuracy?: number;
  timestamp: number;
};
```

Heading APIs require location permission and reject with the same
`LocationError` contract when permission is denied or heading sensors are not
available.

### iOS Accuracy Authorization

Available since `v1.2`.

Use `getAccuracyAuthorization()` to read whether iOS currently grants full or
reduced location accuracy. Android maps fine permission to `full`, coarse-only
permission to `reduced`, and no location permission to `unknown`.

```tsx
import {
  getAccuracyAuthorization,
  requestTemporaryFullAccuracy
} from 'react-native-nitro-geolocation';

const authorization = await getAccuracyAuthorization();

if (authorization === 'reduced') {
  await requestTemporaryFullAccuracy('TurnByTurnNavigation');
}
```

For iOS, `requestTemporaryFullAccuracy(purposeKey)` calls Core Location's
temporary full accuracy API. The `purposeKey` must exist in
`NSLocationTemporaryUsageDescriptionDictionary` in Info.plist, for example:

```xml
<key>NSLocationTemporaryUsageDescriptionDictionary</key>
<dict>
  <key>TurnByTurnNavigation</key>
  <string>Precise location improves turn-by-turn navigation.</string>
</dict>
```

Passing an empty `purposeKey` rejects with `INTERNAL_ERROR`. Android does not
show a temporary accuracy prompt and resolves with the current mapped accuracy
authorization.


## React Hook

### useWatchPosition()

Watch for continuous location updates with automatic lifecycle management.

```tsx
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { useWatchPosition } from 'react-native-nitro-geolocation';

function LiveTracker() {
  const [enabled, setEnabled] = useState(false);

  const { position, error, isWatching } = useWatchPosition({
    enabled,
    accuracy: { android: 'high', ios: 'best' },
    distanceFilter: 10, // Update every 10 meters
    interval: 5000, // Update every 5 seconds (Android)
  });

  return (
    <View>
      <Switch
        value={enabled}
        onValueChange={setEnabled}
        accessibilityLabel="Track location"
      />

      <Text>Status: {isWatching ? 'Watching location' : 'Stopped'}</Text>

      {error && (
        <Text style={{ color: 'red' }}>Error: {error.message}</Text>
      )}

      {position && (
        <View>
          <Text>Lat: {position.coords.latitude}</Text>
          <Text>Lng: {position.coords.longitude}</Text>
          <Text>Accuracy: {position.coords.accuracy}m</Text>
          {position.coords.speed !== null && (
            <Text>Speed: {position.coords.speed}m/s</Text>
          )}
        </View>
      )}
    </View>
  );
}
```

**Options**:

- `enabled?: boolean` - Start/stop watching (default: `false`)
- `accuracy?: { android?: 'high' | 'balanced' | 'low' | 'passive'; ios?: 'bestForNavigation' | 'best' | 'nearestTenMeters' | 'hundredMeters' | 'kilometer' | 'threeKilometers' | 'reduced' }` - Platform-specific accuracy preset. 2.0 callers use this option; `enableHighAccuracy` remains only on `/compat`.
- `granularity?: 'permission' | 'coarse' | 'fine'` - Android-only request granularity, available since `v1.2`
- `waitForAccurateLocation?: boolean` - Android-only high-accuracy initial update tuning, available since `v1.2`
- `maxUpdateAge?: number` - Android-only maximum age for an initial update, available since `v1.2`
- `maxUpdateDelay?: number` - Android-only batching delay, available since `v1.2`
- `maxUpdates?: number` - Android-only watch update limit, available since `v1.2`
- `distanceFilter?: number` - Minimum distance change in meters
- `interval?: number` - Update interval in ms (Android)
- `fastestInterval?: number` - Fastest interval in ms (Android)
- `timeout?: number` - Request timeout
- `maximumAge?: number` - Max cached location age
- `useSignificantChanges?: boolean` - Use significant changes mode (iOS)
- `activityType?: 'other' | 'automotiveNavigation' | 'fitness' | 'otherNavigation' | 'airborne'` - iOS Core Location activity type, available since `v1.2`
- `pausesLocationUpdatesAutomatically?: boolean` - iOS automatic pause behavior, available since `v1.2`
- `showsBackgroundLocationIndicator?: boolean` - iOS background location indicator, available since `v1.2`

**Returns**:

- `position: GeolocationResponse | null` - Latest position (null if no update yet)
- `error: LocationError | null` - Error details if location watching failed
- `isWatching: boolean` - Whether currently watching

**Key Features**:

- ✅ **Auto cleanup**: Unsubscribes when component unmounts or `enabled` becomes `false`
- ✅ **Declarative**: Toggle with `enabled` prop
- ✅ **No watch ID management**: Handled internally
- ✅ **Battery efficient**: Native subscription stops immediately when disabled
- ✅ **Reactive**: Changes to options restart the watch

**Common Patterns**:

1.  **Toggle tracking**:
    ```tsx
    const [tracking, setTracking] = useState(false);
    const { position } = useWatchPosition({ enabled: tracking });
    ```
2.  **Conditional tracking** (track only when screen is focused):
    ```tsx
    const isFocused = useIsFocused(); // React Navigation
    const { position } = useWatchPosition({ enabled: isFocused });
    ```
3.  **Track only when permission granted**:
    ```tsx
    const [hasPermission, setHasPermission] = useState(false);
    const { position, error } = useWatchPosition({
      enabled: hasPermission,
      accuracy: { android: 'high', ios: 'best' },
    });
    ```


## Low-level Functions (Advanced)

For non-React code or advanced use cases, you can use the low-level watch API.

### watchPosition()

```tsx
import { watchPosition, unwatch } from 'react-native-nitro-geolocation';

const token = watchPosition(
  (position) => {
    console.log('Position updated:', position.coords);
  },
  (error) => {
    console.error('Location error:', error.message);
  },
  {
    accuracy: { android: 'high', ios: 'best' },
    distanceFilter: 10
  }
);

// Later: cleanup
unwatch(token);
```

**Parameters**:
- `onUpdate: (position: GeolocationResponse) => void` - Success callback
- `onError?: (error: LocationError) => void` - Error callback
- `options?: LocationRequestOptions` - Location options

**Returns**: `string` - Subscription token

### unwatch()

Stop a specific watch subscription.

```tsx
import { unwatch } from 'react-native-nitro-geolocation';

unwatch(token);
```

### getActiveWatches()

Read the active position and heading subscriptions without starting
or changing location services:

```tsx
import { getActiveWatches } from 'react-native-nitro-geolocation';

const active = getActiveWatches();
// [{ token: '...', kind: 'position' }]
```

See [Watch observability](/guide/watch-observability) for the native merge,
restart, automatic `maxUpdates` removal, and cleanup contracts.

### stopObserving()

Stop ALL watch subscriptions immediately.

```tsx
import { stopObserving } from 'react-native-nitro-geolocation';

// Emergency cleanup - stops all location tracking
stopObserving();
```


## Advanced Patterns

### Permission Check Before Location Request

```tsx
import {
  checkPermission,
  requestPermission,
  getCurrentPosition
} from 'react-native-nitro-geolocation';

async function getLocationWithPermission() {
  // Check permission first
  let status = await checkPermission();

  // Request if needed
  if (status !== 'granted') {
    status = await requestPermission();
  }

  // Get location if granted
  if (status === 'granted') {
    const position = await getCurrentPosition({
      accuracy: { android: 'high', ios: 'best' }
    });
    return position;
  } else {
    throw new Error('Permission denied');
  }
}
```

### Conditional Tracking Based on App State

```tsx
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useWatchPosition } from 'react-native-nitro-geolocation';

function BackgroundTracker() {
  const [isActive, setIsActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setIsActive(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  const { position, error } = useWatchPosition({
    enabled: isActive,
    distanceFilter: 50,
  });

  return (
    <>
      {error && <ErrorBanner message={error.message} />}
      <Map position={position?.coords} />
    </>
  );
}
```


## TypeScript Support

All exports are fully typed:

```typescript
import type {
  PermissionStatus,
  CurrentPositionOptions,
  LastKnownPositionOptions,
  LocationRequestOptions,
  LocationErrorCode,
  LocationError,
  GeolocationResponse,
  GeolocationCoordinates,
  LocationProviderUsed,
  LocationAvailability,
  LocationAvailabilityReason,
  NullableDouble,
  LocationReadiness,
  LocationReadinessRemediation,
  GeolocationConfiguration
} from 'react-native-nitro-geolocation';
```

`NullableDouble` is `number | null`. It is the shared scalar used by
`GeolocationCoordinates.altitude`, `altitudeAccuracy`, `heading`, and `speed`.

The deprecated 1.x configuration alias was removed in 2.0. Use
`GeolocationConfiguration`.

### Type Inference

Functions and hooks provide full type inference:

```tsx
const { position } = useWatchPosition({ enabled: true });
// position: GeolocationResponse | null (inferred)

const pos = await getCurrentPosition();
// pos: GeolocationResponse (inferred)

const status = await requestPermission();
// status: PermissionStatus (inferred)
```


## Comparison with Compat API

| Feature          | Package import                   | Compat API                               |
| ---------------- | ---------------------------------------- | ---------------------------------------- |
| **Import**       | `react-native-nitro-geolocation`         | `react-native-nitro-geolocation/compat`  |
| **Pattern**      | Functions + Hook                         | Callbacks                                |
| **Configuration**| `setConfiguration()`                     | `setRNConfiguration()`                   |
| **Permission**   | `requestPermission()`                    | `requestAuthorization()`                 |
| **Get Location** | `getCurrentPosition()` (Promise)         | `getCurrentPosition()` (callbacks)       |
| **Watch**        | `useWatchPosition({ enabled })`          | `watchPosition()` / `clearWatch()`       |
| **Cleanup**      | Automatic (hook)                         | Manual (`clearWatch`)                    |
| **Watch ID**     | Hidden (internal)                        | User-managed                             |
| **TypeScript**   | Full inference                           | Typed callback contracts                 |
| **React components** | Declarative hook available          | Manual effect and cleanup ownership      |


## Migration from Compat

**Before (Compat API)**:

```tsx
import Geolocation from 'react-native-nitro-geolocation/compat';

function LocationTracker() {
  const [position, setPosition] = useState(null);
  const watchIdRef = useRef(null);

  useEffect(() => {
    watchIdRef.current = Geolocation.watchPosition(
      (pos) => setPosition(pos),
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );

    return () => {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return <Map position={position} />;
}
```

**After**:

```tsx
import { useWatchPosition } from 'react-native-nitro-geolocation';

function LocationTracker() {
  const { position } = useWatchPosition({
    enabled: true,
    accuracy: { android: 'high', ios: 'best' },
  });

  return <Map position={position} />;
}
```

**Benefits**:

- No watch ID management
- Automatic cleanup
- Declarative enable/disable
- Promise-based control flow and inferred results
