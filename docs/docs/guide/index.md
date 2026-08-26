---
title: Choose your path
description: Pick the shortest React Native Nitro Geolocation 2.0 path for a new app, migration, Expo build, or background integration.
---

# Choose your path

You are reading the **2.0 release-candidate** documentation. Use this page to
pick one path; you do not need to read every guide before starting.

| I want to… | Start here | Outcome |
| --- | --- | --- |
| Add foreground location to a new app | [Install and get a location](./quick-start.md) | A foreground-only screen that renders coordinates |
| Upgrade Nitro Geolocation 1.x | [Upgrade from 1.x](./upgrade-from-v1.md) | All seven 2.0 breaking changes reviewed and tested |
| Replace `@react-native-community/geolocation` | [Community migration](./community-migration.md) | `/compat` first, then an optional Modern API refactor |
| Replace `react-native-geolocation-service` | [Service migration](./service-migration.md) | A direct Modern API migration |
| Use an Expo app | [Expo development builds](./expo-development-build.md) | A custom native build; Expo Go is not supported |
| Track when the app is not active | [Background Location](../background/overview.md) | Native background tracking with platform-specific setup |
| Evaluate the RC for release | [Release readiness](./release-readiness.md) | Tested-stack, RC-policy, and ship-checklist review |
| Diagnose an existing integration | [Troubleshooting](./troubleshooting.md) | A readiness snapshot and a useful issue report |

## Choose an API surface

The package has three intentionally separate entry points.

| Surface | Import | Best for | Platform boundary |
| --- | --- | --- | --- |
| **Modern API** | `react-native-nitro-geolocation` | New foreground code, Promise APIs, typed readiness, React watches | Native and web foreground |
| **Compatibility API** | `react-native-nitro-geolocation/compat` | A controlled migration from the core community callback API | Native and web foreground |
| **Background API** | `react-native-nitro-geolocation/background` | Tracking, geofencing, persistence, Headless JS, and native sync | Native only; web imports return unsupported results |

`/compat` preserves the core callback methods and numeric error contract. It is
a migration-friendly API-shape path, not a promise that every legacy global,
default, or platform-specific option behaves identically. Review the
[compatibility matrix](./compat-api.md#compatibility-scope) before shipping.

## Check the support boundary

- React Native 0.75 or newer with New Architecture and Nitro Modules is
  required for native apps.
- Bare React Native and Expo development/custom native builds are supported.
  Expo Go is not supported.
- CocoaPods is the supported iOS dependency path. React Native 0.87 SwiftPM-only
  projects must wait for official Nitro Modules SwiftPM support.
- The Modern and Compatibility foreground APIs support browser builds through
  `navigator.geolocation`. Background Location is native-only.
- Android and iOS share public contracts but retain documented OS behavior and
  reliability limits.

The peer range describes where installation is allowed; it is broader than the
single reference combination continuously exercised by this repository. See
[Release readiness](./release-readiness.md) for the declared and tested scopes.

## RC expectations

Install an exact RC when reproducing or approving behavior:

```bash
yarn add react-native-nitro-modules@0.35.10 react-native-nitro-geolocation@2.0.0-rc.0
```

Release candidates may still receive contract fixes before 2.0 stable. Do not
silently follow the moving `@rc` tag in a production lockfile. Keep a tested
1.x rollback branch until the [upgrade checklist](./upgrade-from-v1.md) and
[release checklist](./release-readiness.md#ship-checklist) pass in your app.

## Next action

For a new integration, continue to [Install and get a location](./quick-start.md).
For any existing Nitro Geolocation 1.x app, start with
[Upgrade from 1.x](./upgrade-from-v1.md) before opening the API reference.
