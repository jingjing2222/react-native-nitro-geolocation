---
title: Migration Assistance
---

# Migration Assistance

Use this guide when migrating an existing app from
`@react-native-community/geolocation`, `navigator.geolocation`,
`react-native-geolocation-service`, or `react-native-nitro-geolocation/compat`
toward the Modern API.

## Agent Skill

This repository publishes Agent Skills-compatible migration playbooks for
coding agents.

For `@react-native-community/geolocation`, `navigator.geolocation`, or existing
`/compat` code, use:

[`community-migration`](https://github.com/jingjing2222/react-native-nitro-geolocation/tree/main/skills/community-migration).

Install it with the Vercel Labs `skills` CLI:

```bash
npx skills add jingjing2222/react-native-nitro-geolocation --skill community-migration
```

For `react-native-geolocation-service`, migrate directly to the Modern API with:

[`service-migration`](https://github.com/jingjing2222/react-native-nitro-geolocation/tree/main/skills/service-migration).

```bash
npx skills add jingjing2222/react-native-nitro-geolocation --skill service-migration
```

Both skills are migration assistance, not fully automatic migrations.

The community migration skill uses a two-phase workflow:

1. Run a package-manager-aware compat bootstrap script that installs
   `react-native-nitro-modules` and `react-native-nitro-geolocation`, rewrites
   `@react-native-community/geolocation` import sources to
   `react-native-nitro-geolocation/compat`, removes the legacy package, and
   prints validation commands for scripts that exist in the target app.
2. Refactor `/compat` call sites to Modern API best practices using explicit
   criteria for permission timing, React lifecycle ownership, watch cleanup,
   cache-vs-fresh reads, accuracy, and Android provider/settings handling.

The service migration skill skips `/compat` and targets the Modern API directly.
It preserves service-specific behavior such as `accuracy`, fused-provider
intent, Android settings-dialog handling, `mocked`/`provider` metadata, and
provider-related error codes.

## Migration Shape

For `@react-native-community/geolocation`, first make the mechanical
dependency/import change and verify the app still builds. Then refactor the
callback-based compat code to Modern API calls.

For `react-native-geolocation-service`, migrate directly to named Modern API
imports. That package's Android fused-provider and settings-dialog options map
more naturally to Modern APIs such as
`setConfiguration({ locationProvider: 'playServices' })` and
`requestLocationSettings()`.

The final target state should avoid runtime imports from
`@react-native-community/geolocation`, `navigator.geolocation`, and
`react-native-nitro-geolocation/compat` unless the app deliberately keeps a
compatibility fallback.

## Modern API Targets

| Legacy or compat usage | Modern API target |
| --- | --- |
| `getCurrentPosition(success, error, options)` | `await getCurrentPosition(options)` |
| cache-first startup location reads | `await getLastKnownPosition(options)` |
| `requestAuthorization(success, error)` | `await requestPermission()` |
| `setRNConfiguration(config)` | `setConfiguration(config)` |
| `watchPosition` in function components | `useWatchPosition({ enabled, ...options })` |
| `watchPosition` in services, classes, or tasks | `watchPosition(...)` + `unwatch(token)` |
| `clearWatch(id)` | `unwatch(token)` |
| `enableHighAccuracy: true` | `accuracy: { android: 'high', ios: 'best' }` |

Use `checkPermission()` when you only need to read permission status. Use
`requestPermission()` only when the app is ready to show the native permission
prompt.

For Android flows that require precise location, consider
`getLocationAvailability()` or `requestLocationSettings()` before requesting a
fresh position. Avoid interrupting approximate, passive, or low-power flows
with settings prompts unless the feature requires it.

## Agent-Readable Docs

The public docs are also available in agent-readable form:

```bash
curl -fsSL https://react-native-nitro-geolocation.pages.dev/llms.txt
curl -fsSL https://react-native-nitro-geolocation.pages.dev/llms-full.txt
```

Use `llms.txt` as the docs index. Use `llms-full.txt` when an agent needs exact
API names, option semantics, or examples. If the target app pins an older
`react-native-nitro-geolocation` version, confirm API availability in the
installed package types before using docs-only APIs.
