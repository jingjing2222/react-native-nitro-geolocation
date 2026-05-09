---
name: community-migration
description: Migrate React Native apps from @react-native-community/geolocation to react-native-nitro-geolocation. Use when installing the Nitro packages, running the bundled compat bootstrap codemod, removing @react-native-community/geolocation, then refactoring community-compatible call sites to the Modern API with Promise functions, requestPermission, setConfiguration, useWatchPosition, watchPosition, and unwatch.
---

# Community Geolocation Migration

Use a two-phase migration:

1. Bootstrap safely to `/compat` so the app stops depending on
   `@react-native-community/geolocation`.
2. Refactor from `/compat` to the Modern API best-practice shape.

Do not start by hand-converting every callback call site. First make the
mechanical package/import migration small and reversible, verify it, then do
the semantic Modern API refactor.

## Workflow

1. Inspect the target app root and check the worktree state.
2. Resolve `scripts/migrate-to-compat.mjs` relative to this `SKILL.md`.
3. Run a dry run from the target app root:
   ```bash
   node <skill-dir>/scripts/migrate-to-compat.mjs --root <app-root> --dry-run
   ```
4. If the dry run is expected, run it for real:
   ```bash
   node <skill-dir>/scripts/migrate-to-compat.mjs --root <app-root>
   ```
   The script detects `packageManager` or lockfiles, installs missing
   `react-native-nitro-modules` and `react-native-nitro-geolocation`, rewrites
   `@react-native-community/geolocation` import sources to
   `react-native-nitro-geolocation/compat`, removes
   `@react-native-community/geolocation`, and prints package-manager-specific
   validation commands that exist in the app's `package.json`.
5. Run the printed validation commands. Do not hardcode `yarn`, `npm`, `pnpm`,
   or `bun`; use the detected package manager and only scripts that exist.
6. Refresh the public docs context when network is available:
   ```bash
   curl -fsSL https://react-native-nitro-geolocation.pages.dev/llms.txt
   curl -fsSL https://react-native-nitro-geolocation.pages.dev/llms-full.txt
   ```
   Read `llms.txt` first as the docs index. Use `llms-full.txt` only when you
   need exact API names, option semantics, or examples for the Modern API,
   Compat API, quick start, or platform setup. If the app already pins an older
   `react-native-nitro-geolocation` version, confirm an API exists in
   `node_modules/react-native-nitro-geolocation` or the installed package types
   before using docs-only APIs.
7. Find remaining community geolocation usage:
   ```bash
   rg "@react-native-community/geolocation|react-native-nitro-geolocation/compat|setRNConfiguration|requestAuthorization|watchPosition|clearWatch|stopObserving|navigator\\.geolocation"
   ```
   Treat `navigator.geolocation` as a manual-review compatibility site, not as
   the primary migration scope.
8. Inspect each call site before refactoring. Identify whether it is in a React
   function component, class component, hook, service module, background task, or
   test.
9. Replace compat imports with named Modern API imports from
   `react-native-nitro-geolocation`. Remove `Geolocation` default-object usage
   when the migrated file no longer needs it.
10. Convert one-shot and permission APIs to `async`/`await` or explicit Promise
   chains. Preserve existing loading, state, and error behavior.
11. Migrate watches to `useWatchPosition` only where React hook rules allow it.
   Use `watchPosition` plus `unwatch` for non-component code, class components,
   callbacks, conditionals, and services.
12. Flag unsupported or semantic changes in comments or the final report instead
    of guessing.
13. Run the target app's relevant detected validation commands again. If
    validating an actual migrated app flow on device, use `agent-device` when
    available.

## Docs Reference

Use these docs endpoints as the source of truth during the Modern refactor:

- `https://react-native-nitro-geolocation.pages.dev/llms.txt` - concise index
  of available docs pages.
- `https://react-native-nitro-geolocation.pages.dev/llms-full.txt` - complete
  rendered docs content for agent consumption.

Prefer `llms.txt` for navigation and `llms-full.txt` for exact API details. Do
not paste or load the full docs into the final answer; use them to check facts
before editing. If network is unavailable, fall back to local package docs,
README files, and TypeScript declarations in the installed package.

## Best Practice Target

The final migration is not just "no type errors." Prefer this target state:

- No app runtime imports from `@react-native-community/geolocation`,
  `navigator.geolocation`, or `react-native-nitro-geolocation/compat`. Keep
  `/compat` only in deliberate compatibility examples, tests, or migration
  fallback code the user explicitly wants to preserve.
- Configure once near app startup with `setConfiguration()`. Do not leave
  `setRNConfiguration()` or `skipPermissionRequests` in migrated runtime code.
- Use explicit permission flow. Use `checkPermission()` only to read status
  without prompting; call `requestPermission()` from a user-understandable app
  moment before location work needs permission.
- Use Promise APIs for one-shot work. Prefer `getCurrentPosition()` when the
  app needs a fresh position, and `getLastKnownPosition()` only for cache-first
  UI where stale data is acceptable.
- Use lifecycle-safe watches. In function components or custom hooks, prefer
  `useWatchPosition({ enabled })`; outside hook-safe code, use
  `watchPosition()` with scoped `unwatch(token)` cleanup.
- Use explicit `accuracy` presets instead of `enableHighAccuracy`. Preserve
  existing timeout, distance, interval, and cache semantics unless the old code
  was clearly relying on deprecated defaults.
- Keep permission, provider/settings, and watch cleanup behavior visible in the
  code. Do not hide prompts or global cleanup in utility functions unless that
  is already the app's architecture.
- Use typed Modern errors where handling is specific. Match on
  `LocationErrorCode` for permission denied, timeout, settings-not-satisfied,
  or provider/setup failures instead of parsing error messages.

## Selection Criteria

Apply these criteria at each call site, in this order:

1. Preserve user-visible behavior first: same trigger, same loading state, same
   success/error UI, same cleanup timing.
2. Respect React rules: never introduce hooks in classes, callbacks,
   conditionals, loops, services, or non-React modules.
3. Prefer the narrowest lifecycle: hook-managed watch for component state,
   token-managed watch for services, one-shot Promise for button/request flows.
4. Prefer explicit user consent: do not convert old implicit permission behavior
   into an app-start permission prompt.
5. Prefer battery-aware defaults: only request high accuracy, frequent
   intervals, background updates, or settings dialogs when the old code or app
   feature justifies it.
6. Prefer type-safe Modern API names at module boundaries: avoid passing a
   `Geolocation` object through app code after refactoring.

Use this API choice table:

| Legacy pattern | Modern target | Choose it when | Avoid it when |
| --- | --- | --- | --- |
| `getCurrentPosition(success, error, options)` | `await getCurrentPosition(options)` | A user action or flow needs a fresh position. | The UI can start from cached location only; consider `getLastKnownPosition()`. |
| Cached/stale startup read via `maximumAge` | `await getLastKnownPosition(options)` | Startup UI, stale-while-refresh, or cache-only flows can tolerate no fresh request. | The feature needs a fresh fix or should prompt provider/settings resolution. |
| `requestAuthorization(success, error)` | `await requestPermission()` | The app is ready to show the native permission prompt. | You only need to display current status; use `checkPermission()`. |
| `setRNConfiguration(config)` | `setConfiguration(config)` | App startup or native bootstrap code sets global location config once. | A screen-level call would repeatedly mutate global config. |
| `watchPosition` in a function component | `useWatchPosition({ enabled, ...options })` | Position drives React render state and the call can be at hook-safe top level. | The code is a class component, event callback, conditional branch, or service. |
| `watchPosition` in services/classes/tasks | `watchPosition(...)` + `unwatch(token)` | A non-React lifecycle owns the subscription. | A React function component can express the lifecycle with `enabled`. |
| `clearWatch(id)` | `unwatch(token)` | Stopping one known Modern watch. | The old code intentionally stopped every watcher; review `stopObserving()`. |
| `enableHighAccuracy: true` | `accuracy: { android: "high", ios: "best" }` | The feature needs precise location. | Low-power or approximate location is enough. |
| Android precise flow that can fail due to settings | `getLocationAvailability()` / `requestLocationSettings()` before location request | The UX can ask users to enable provider/settings for navigation or precise location. | Passive/background or approximate flows should not interrupt users. |

## Import Patterns

The bootstrap script handles this mechanical source rewrite:

```ts
import Geolocation from "@react-native-community/geolocation";
```

to:

```ts
import Geolocation from "react-native-nitro-geolocation/compat";
```

After verification, refactor compat imports to named Modern imports:

```ts
import {
  getCurrentPosition,
  requestPermission,
  setConfiguration,
  useWatchPosition,
  watchPosition,
  unwatch
} from "react-native-nitro-geolocation";
```

Import only the symbols each file needs.

`navigator.geolocation` usage is reported by the script but not rewritten. It
needs manual inspection because it is often a global shim or browser fallback.

## API Mappings

### getCurrentPosition

Before:

```ts
Geolocation.getCurrentPosition(
  (position) => setPosition(position),
  (error) => setError(error),
  { enableHighAccuracy: true, timeout: 15000 }
);
```

After:

```ts
try {
  const position = await getCurrentPosition({
    accuracy: { android: "high", ios: "best" },
    timeout: 15000
  });
  setPosition(position);
} catch (error) {
  setError(error);
}
```

If the containing function cannot become `async`, keep the Promise chain:

```ts
getCurrentPosition(options).then(onSuccess).catch(onError);
```

### requestAuthorization

Replace `requestAuthorization(success?, error?)` with `requestPermission()`.
Move success callback behavior after a granted result and move error callback
behavior into `catch`.

```ts
const status = await requestPermission();
if (status === "granted") {
  onGranted();
}
```

### setRNConfiguration

Replace `setRNConfiguration` with `setConfiguration` at app startup.

```ts
setConfiguration({
  authorizationLevel: "whenInUse",
  enableBackgroundLocationUpdates: false,
  locationProvider: "auto"
});
```

Do not migrate `skipPermissionRequests`; Modern API has no equivalent because
permission requests must be explicit through `requestPermission()`.

### watchPosition in React Components

Use `useWatchPosition` in function components or custom hooks only. Preserve
the old start/stop condition through `enabled`.

Before:

```tsx
useEffect(() => {
  const watchId = Geolocation.watchPosition(onPosition, onError, {
    enableHighAccuracy: true,
    distanceFilter: 10
  });

  return () => Geolocation.clearWatch(watchId);
}, []);
```

After:

```tsx
const { position, error, isWatching } = useWatchPosition({
  enabled: true,
  accuracy: { android: "high", ios: "best" },
  distanceFilter: 10
});
```

Wire `position`, `error`, and `isWatching` into the component's existing state
or render path. If callbacks perform side effects, add a separate `useEffect`
that reacts to `position` or `error`.

### watchPosition Outside Hook-Safe Code

Use the low-level Modern watch API outside function component top level:

```ts
const token = watchPosition(onPosition, onError, {
  accuracy: { android: "high", ios: "best" },
  distanceFilter: 10
});

unwatch(token);
```

Replace `clearWatch(watchId)` with `unwatch(token)`. Keep `stopObserving()`
only when the old code intentionally stopped all geolocation subscriptions;
otherwise prefer targeted `unwatch(token)`.

## Options

- Replace `enableHighAccuracy: true` with
  `accuracy: { android: "high", ios: "best" }`.
- For `enableHighAccuracy: false`, prefer omitting accuracy unless the old code
  clearly required reduced precision. If reduced precision matters, choose an
  explicit preset and note the semantic decision.
- Preserve `timeout`, `maximumAge`, `distanceFilter`, `interval`,
  `fastestInterval`, and `useSignificantChanges` when present.
- Prefer Modern platform options such as `granularity`,
  `waitForAccurateLocation`, `activityType`, and
  `pausesLocationUpdatesAutomatically` only when the migrated code already has
  an equivalent requirement.

## Do Not Guess

Flag these for the user instead of silently rewriting:

- Code that relies on `skipPermissionRequests`.
- Class components where a hook migration would require a component refactor.
- Watch callbacks with side effects that need ordering guarantees.
- Global `navigator.geolocation` monkey patches.
- Tests that assert exact legacy callback timing or watch id types.
- Permission flows that depend on iOS "always" vs "when in use" copy or timing.

## Verification

Use the target app's detected package manager and existing scripts. The
bootstrap script prints commands for available `typecheck`, `lint`, and `test`
scripts, for example `pnpm typecheck`, `npm run lint`, `bun run test`, or
`yarn test`.

Do not invent missing scripts. If a project has no standard validation scripts,
run the nearest equivalent documented by that app. For device-sensitive
behavior, verify at least one permission request, one current-position request,
and one watch start/stop flow on iOS or Android.
