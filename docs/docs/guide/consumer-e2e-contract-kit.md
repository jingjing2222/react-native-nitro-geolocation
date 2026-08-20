# Consumer E2E contract kit

This kit gives a consuming React Native app one small product page and two
black-box contracts:

- a granted user receives and renders a real native location;
- a denied user does not start a location request and receives an actionable
  permission remedy.

It deliberately uses the public API directly. There is no test-only provider,
hidden retry, fixture branch, or library policy change.

## Copy the page

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
| `consumer-location-status` | Exposes `passed`, `permission-required`, or `failed` |
| `consumer-location-permission` | Exposes the permission observed before a request |
| `consumer-location-native-requests` | Proves denied permission did not reach the native request |
| `consumer-location-position` | Exists only after a valid position is rendered |
| `consumer-location-request-permission` | Gives a denied user an explicit next action |
| `consumer-location-open-settings` | Leaves the app for settings when another prompt cannot recover access |

The page reads `getPermissionDetails()` before `getCurrentPosition()`. It does
not prompt on mount. Its foreground request explicitly selects `whenInUse`, and
its remediation follows `settingsGuidance`: request again when possible, open
app settings when required, or explain a managed restriction. Adapt the
presentation to the product, but preserve those behavioral boundaries.

## Copy the contracts

Copy the two Maestro flows:

- [`consumer-location-contract-happy.yaml`](https://github.com/jingjing2222/react-native-nitro-geolocation/blob/main/examples/v0.81.1/.maestro/consumer-location-contract-happy.yaml)
- [`consumer-location-contract-denied.yaml`](https://github.com/jingjing2222/react-native-nitro-geolocation/blob/main/examples/v0.81.1/.maestro/consumer-location-contract-denied.yaml)

Change `appId` and the `nitrogeolocation://app` deep-link prefix to the consumer
app's registered values. Keep the location injection, native-request count, and
coordinate assertion in the happy flow: asserting only `Status: passed` can
hide a page that never rendered the native result. Keep the denied flow separate
so CI proves the native request count stays zero and reports which contract
failed.

## RED to GREEN

Register a minimal reachable page with the stable selectors first, but leave its
button without location behavior. The happy flow should fail on the native
request and coordinate assertions. Implement the granted path through the public
API and make that flow green before committing it.

Next run the denied flow against a page that calls `getCurrentPosition()`
without a permission gate. It should fail because the native request count is
one and no actionable remediation appears. Add the read-only permission gate
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
