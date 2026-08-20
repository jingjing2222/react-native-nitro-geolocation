# Consumer E2E contract kit

This kit gives a consuming React Native app one small product page and two
black-box contracts:

- a granted user receives and renders a real native location;
- a denied user does not call the public position API and receives an
  actionable permission remedy.

It deliberately uses the public API directly. There is no test-only provider,
hidden retry, fixture branch, or library policy change.

## Copy the page

Complete the foreground location setup in [Quick Start](/guide/quick-start)
before copying the kit. Android needs `ACCESS_FINE_LOCATION` and
`ACCESS_COARSE_LOCATION`; iOS needs `NSLocationWhenInUseUsageDescription`.
Include `authorizationLevel: 'whenInUse'` in the app's single, complete startup
`setConfiguration()` call. The copied screen deliberately does not mutate that
app-wide policy.

Copy
[`ConsumerLocationContractScreen.tsx`](https://github.com/jingjing2222/react-native-nitro-geolocation/blob/main/examples/v0.81.1/src/screens/ConsumerLocationContractScreen.tsx)
into the consuming app, then register it at a deterministic test route. The
repository example uses this React Navigation linking entry:

```ts
const linking = {
  prefixes: ['myapp://app'],
  config: {
    screens: {
      ConsumerLocationContract: 'consumer-location-contract'
    }
  }
};
```

Register the same scheme with each operating system. Add an intent filter to
the Android activity that owns the React Native route:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="myapp" />
</intent-filter>
```

Add the scheme to the iOS app's `Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>myapp</string>
    </array>
  </dict>
</array>
```

If the app already has a deterministic native route, adapt the flows to use it
instead of adding another scheme.

Keep these test IDs stable in the copied page:

| Test ID | Contract |
| --- | --- |
| `consumer-location-run` | Starts the same user action exercised in production |
| `consumer-location-status-<state>` | Exposes `passed`, `permission-required`, or `failed` without localized text |
| `consumer-location-permission-<status>` | Exposes the permission observed before a request |
| `consumer-location-api-attempts-<count>` | Counts this page's calls to the public position API |
| `consumer-location-position-<latitude-e6>-<longitude-e6>` | Encodes the rendered position without presentation text |
| `consumer-location-request-permission` | Gives a denied user an explicit next action |
| `consumer-location-open-settings` | Leaves the app for settings when another prompt cannot recover access |

The page reads `getPermissionDetails()` before `getCurrentPosition()`. It does
not prompt on mount or change global configuration. Its remediation follows
`settingsGuidance`: request again when possible, open app settings when
required, or explain a managed restriction. Adapt and localize the presentation,
but preserve the machine-readable IDs and those behavioral boundaries. The API
attempt ID is page-owned observability, not native telemetry.

## Copy the contracts

Copy the two Maestro flows:

- [`consumer-location-contract-happy.yaml`](https://github.com/jingjing2222/react-native-nitro-geolocation/blob/main/examples/v0.81.1/.maestro/consumer-location-contract-happy.yaml)
- [`consumer-location-contract-denied.yaml`](https://github.com/jingjing2222/react-native-nitro-geolocation/blob/main/examples/v0.81.1/.maestro/consumer-location-contract-denied.yaml)

In both flows, change `appId` and the `nitrogeolocation://app` deep-link prefix
to the consumer app's registered values. Also set
`CONSUMER_APP_DISPLAY_NAME` in the denied flow. The flows reset unrelated
permissions to `unset`, then select only the location boundary under test:
Android `allow`/`deny` and iOS `inuse`/`never`. Keep the location injection,
API-attempt count, and coordinate ID assertion in the happy flow: asserting only
a passed status can hide a page that never rendered the native result. Keep the
denied flow separate so CI proves this page never called the public position API
and reports which contract failed. Its final platform-specific assertion must
identify the consumer app in the system settings UI; adapt that selector if the
consumer's display name or supported OS UI differs.

## RED to GREEN

Register a minimal reachable page with the stable selectors first, but leave its
button without location behavior. The happy flow should fail on the native
API-attempt and coordinate assertions. Implement the granted path through the
public API and make that flow green before committing it.

Next run the denied flow against a page that calls `getCurrentPosition()`
without a permission gate. It should fail because the API-attempt count is one
and no actionable remediation appears. Add the read-only permission gate
and guidance-driven remediation, then make the denied flow green:

```bash
maestro test .maestro/consumer-location-contract-happy.yaml
maestro test .maestro/consumer-location-contract-denied.yaml
```

Run both again against the same release build before committing. Do not replace
the denied case with a mocked JavaScript rejection: the flow controls the real
OS permission state.

## CI boundary

Build and install the release variant before Maestro so the contract covers the
artifact shipped to users. Run Android and iOS jobs separately; their permission
stores and system dialogs are mutually exclusive environments. Use a dedicated
emulator or simulator and inject a location only for the happy path.

These two smoke contracts are intentionally small. Add product-specific edge
cases such as provider disabled, approximate permission, timeout, or background
delivery only when the consuming feature depends on them.
