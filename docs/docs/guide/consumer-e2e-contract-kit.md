# Consumer E2E contract kit

This kit gives a consuming React Native app one small product page and two
black-box contracts:

- a granted user receives and renders a real native location;
- a denied user does not start a location request and sees a permission action.

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

Keep these test IDs stable in the copied page:

| Test ID | Contract |
| --- | --- |
| `consumer-location-run` | Starts the same user action exercised in production |
| `consumer-location-status` | Exposes `passed`, `permission-required`, or `failed` |
| `consumer-location-permission` | Exposes the permission observed before a request |
| `consumer-location-position` | Exists only after a valid position is rendered |
| `consumer-location-request-permission` | Gives a denied user an explicit next action |

The page checks permission before `getCurrentPosition()`. It does not prompt on
mount, and it requests permission only after a user presses the permission
button. Adapt the presentation to the product, but preserve those behavioral
boundaries.

## Copy the contracts

Copy the two Maestro flows:

- [`consumer-location-contract-happy.yaml`](https://github.com/jingjing2222/react-native-nitro-geolocation/blob/main/examples/v0.81.1/.maestro/consumer-location-contract-happy.yaml)
- [`consumer-location-contract-denied.yaml`](https://github.com/jingjing2222/react-native-nitro-geolocation/blob/main/examples/v0.81.1/.maestro/consumer-location-contract-denied.yaml)

Change `appId` and the `nitrogeolocation://app` deep-link prefix to the
consumer app's values. Keep the location injection and coordinate assertion in
the happy flow: asserting only `Status: passed` can hide a page that never
rendered the native result. Keep the denied flow separate so CI reports which
contract failed.

## RED to GREEN

Add and run the flows before registering the page. Both should fail because the
route or selectors do not exist. Then add the page and make the cases pass one
at a time:

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
