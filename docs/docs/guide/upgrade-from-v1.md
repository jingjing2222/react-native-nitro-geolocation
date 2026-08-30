---
title: Upgrade from 1.x to 2.0
description: Migrate every React Native Nitro Geolocation 2.0 breaking change with verification and rollback gates.
---

# Upgrade from 1.x to 2.0

Use this guide for an app already running `react-native-nitro-geolocation` 1.x.
The 2.0 release candidate has **seven** breaking contract changes. Apply them in
a branch and keep the currently deployed 1.x version available for rollback.

## Plan the upgrade

1. Record the exact working React Native, Nitro Modules, and Geolocation
   versions from the current lockfile.
2. Inventory root, `/compat`, and `/background` imports separately.
3. Create or keep tests for permission denial, a fresh fix, cached reads,
   watches, Android settings resolution, and background event recovery used by
   your product.
4. Pin the RC rather than following a moving tag:

```bash
yarn add react-native-nitro-modules@0.35.10 react-native-nitro-geolocation@2.0.0-rc.4
```

5. Reinstall pods, rebuild both native apps, and run
   `yarn nitro-geolocation doctor` before changing application code.

Commit the dependency/native-build gate separately. If it fails, restore the
lockfile and native dependency state before attempting API migrations.

## Breaking-change checklist

| Change | Who is affected | Required action | Verification |
| --- | --- | --- | --- |
| String Modern error codes | Root API callers comparing or persisting numeric codes | Compare against `LocationErrorCodes`; migrate persisted values | Denial, timeout, unavailable-provider tests |
| Removed configuration alias | Type imports of `ModernGeolocationConfiguration` | Use `GeolocationConfiguration` | Typecheck |
| Watch Manager v2 semantics | Apps with multiple Modern watches or implicit cleanup assumptions | Verify per-watch thresholds and ownership | Two-watch and unmount/stop tests |
| Split last-known reads | Callers awaiting or passing options to `getLastKnownPosition()` | Choose synchronous module cache or async platform cache | Empty, fresh, and stale cache tests |
| Removed Modern `enableHighAccuracy` | Root current/watch/settings options | Use platform `accuracy` presets | Approximate and precise flows |
| Unified background events | Background provider/lifecycle listeners and persisted event consumers | Handle the unified discriminated stream | Live plus stored-event tests |
| Deterministic settings result | Code expecting cancel/unavailable to reject | Branch on `result.outcome` | Satisfied, cancelled, unavailable tests |

## 1. Use string Modern error codes

The Modern root API no longer uses numeric codes. `/compat` intentionally keeps
the numeric W3C contract.

```ts
// 1.x
if (error.code === 1) {
  showPermissionHelp();
}

// 2.0 Modern API
import { LocationErrorCodes } from 'react-native-nitro-geolocation';

if (error.code === LocationErrorCodes.PERMISSION_DENIED) {
  showPermissionHelp();
}
```

If error codes are stored in analytics, queues, or state, version the payload or
map old numbers before deploying code that reads both formats. See the complete
[error mapping](./v2-error-migration.md).

**Verify:** exercise permission denial, timeout, unavailable provider, and
Android settings-not-satisfied paths. Confirm `/compat` consumers still receive
numeric codes.

## 2. Replace the removed configuration alias

```ts
// 1.x
import type { ModernGeolocationConfiguration } from 'react-native-nitro-geolocation';

// 2.0
import type { GeolocationConfiguration } from 'react-native-nitro-geolocation';
```

This is a type-only rename. **Verify:** search for the old name and run the app's
full TypeScript check.

## 3. Verify Watch Manager v2 behavior

Native acquisition can be shared, but each Modern watch now enforces its own
callback thresholds and cleanup lifecycle. Do not assume that stopping one watch
stops another, or that one watch's distance/interval policy controls all
subscribers.

**Verify:** start two watches with different thresholds, confirm each receives
only its expected callbacks, stop one, and confirm the other continues. For
hooks, unmount the owning component and confirm its watch disappears. Use
`getActiveWatches()` during development and read [Watch observability](./watch-observability.md).

## 4. Choose the correct last-known read

```ts
// 1.x: async platform/provider cache
const cached = await getLastKnownPosition({ maximumAge: 60_000 });

// 2.0: synchronous location already observed by this JS module
const observed = getLastKnownPosition();

// 2.0: async cache-only native/provider query
const cached = await getLastKnownPositionAsync({ maximumAge: 60_000 });
```

Neither 2.0 function starts a fresh location request. Use
`getCurrentPosition()` when the feature requires a fresh fix.

**Verify:** cold start returns `undefined` when no acceptable cache exists;
observing a current/watch position populates the module cache; an expired
platform cache is filtered by `maximumAge`.

## 5. Replace Modern `enableHighAccuracy`

```ts
// 1.x Modern API
await getCurrentPosition({ enableHighAccuracy: true });

// 2.0 Modern API
await getCurrentPosition({
  accuracy: { android: 'high', ios: 'best' },
});
```

`/compat` still accepts `enableHighAccuracy`. Do not translate approximate or
low-power product flows to high accuracy automatically; choose the preset that
matches the user outcome.

**Verify:** test approximate/coarse permission, precise permission, and disabled
device-location settings on the physical devices your app supports.

## 6. Migrate to unified background events

Provider status and iOS location lifecycle changes now use the same background
event stream and can be retained when persistence is enabled. Update exhaustive
event switches and stored-event deserialization before enabling 2.0 in
production. `onLocationLifecycleChange()` remains a convenience filter.

Follow [2.0 Unified Background Events](./v2-unified-background-events.md) for the
new cases and examples.

**Verify:** receive a live provider/lifecycle event, drain a stored copy after JS
startup, and confirm event IDs are handled idempotently if your product can see
both delivery paths.

## 7. Handle settings outcomes as data

Expected Android resolution outcomes no longer reject.

```ts
const result = await requestLocationSettings({
  accuracy: { android: 'high' },
});

switch (result.outcome) {
  case 'satisfied':
    break;
  case 'cancelled':
  case 'unavailable':
  case 'activityMissing':
    showSettingsHelp(result.outcome);
    break;
}
```

Only request failures, such as a concurrent resolution request, reject. iOS
reports `satisfied` or `unavailable` without opening an Android-style dialog.

**Verify:** cover every outcome used by the product and keep a catch path for an
actual request failure.

## Release gate

Before merging the upgrade:

- [ ] No `ModernGeolocationConfiguration` root type imports remain.
- [ ] No Modern root options still use `enableHighAccuracy`.
- [ ] Numeric error comparisons exist only under `/compat` or in explicit legacy
      data migration code.
- [ ] Every last-known call deliberately chooses module cache or platform cache.
- [ ] Concurrent watch ownership and cleanup pass on iOS and Android.
- [ ] Settings outcomes and background event unions are handled exhaustively.
- [ ] Foreground permission, current fix, cache, watch, and every enabled
      background feature pass in a release build.
- [ ] The [consumer E2E contract](./consumer-e2e-contract-kit.md),
      [privacy review](./privacy-compliance.md), and
      [release-readiness checklist](./release-readiness.md#ship-checklist) cover
      the product's actual feature set.

## Roll back safely

Rollback is an application release, not a runtime toggle. Restore the exact 1.x
package and matching Nitro Modules versions from the previous lockfile, restore
the previous native dependency state, rebuild both apps, and redeploy. If 2.0
wrote string error codes or unified background events to persistent application
storage, keep readers backward-compatible before sending a 1.x binary back to
users.

Report a migration problem with the evidence listed in
[Troubleshooting](./troubleshooting.md#open-a-useful-report).
