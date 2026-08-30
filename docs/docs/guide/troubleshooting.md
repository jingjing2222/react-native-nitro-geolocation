---
title: Troubleshooting and support
description: Diagnose install, permission, provider, foreground, and background location problems and open a useful report.
---

# Troubleshooting and support

Start with read-only evidence. Do not repeatedly request permission, add every
manifest capability, or request background access to solve a foreground issue.

## Triage by symptom

| Symptom | First check | Next action |
| --- | --- | --- |
| Native module/linking error | `nitro-geolocation doctor` after native generation | Reinstall pods, clean/rebuild the native app, confirm New Architecture and Nitro versions |
| Permission is denied or restricted | `getPermissionDetails()` | Explain the feature; request only when allowed, otherwise offer a user-chosen settings route |
| Permission granted but no fix | `getLocationReadiness()` | Check device services/provider, accuracy requirement, environment, and timeout |
| Android high accuracy unavailable | `getLocationReadiness()` then `requestLocationSettings()` from a user action | Branch on the resolved settings outcome; do not assume cancellation rejects |
| Cached value missing | Confirm which cache API is used | `getLastKnownPosition()` reads observed JS cache; `getLastKnownPositionAsync()` queries cache-only sources |
| Watch duplicates or survives a screen | `getActiveWatches()` in development | Give each owner one cleanup path; prefer `useWatchPosition` in components |
| Background tracking is silent | `diagnoseBackgroundLocation()` | Follow [Background troubleshooting](../background/troubleshooting.md) and inspect OS restrictions |
| Web request never prompts | Secure context and browser permissions | Browser policy owns the prompt; standalone `requestPermission()` cannot force one |

## 1. Check the installation

```bash
yarn nitro-geolocation doctor
```

For a monorepo or CI artifact:

```bash
yarn nitro-geolocation doctor --project apps/mobile --json
```

Run it after the native project exists and after permission declarations are
added. The doctor does not edit files. A clean JavaScript reinstall is not a
substitute for rebuilding an app binary after native dependency changes.

## 2. Capture foreground readiness

```ts
import {
  getLocationReadiness,
  getPermissionDetails,
} from 'react-native-nitro-geolocation';

const [permission, readiness] = await Promise.all([
  getPermissionDetails(),
  getLocationReadiness(),
]);

console.log({ permission, readiness });
```

These calls inspect state without acquiring a location. Use their normalized
guidance/remediation fields in product UI rather than inferring prompt behavior
from an OS name alone.

Then reproduce one explicit location request and record the structured error
`code` and `message`. 2.0 API codes are strings; `/compat` codes remain
numeric. Remove exact coordinates from logs before sharing them.

## 3. Separate foreground and background failures

First confirm a foreground location through the
[quick start](./quick-start.md). Only then debug `/background` setup. Background
tracking adds different permission, notification, service, persistence, and OS
lifecycle contracts; it cannot repair a foreground provider failure.

For background evidence:

```ts
import {
  diagnoseBackgroundLocation,
  getBackgroundLocationStatus,
} from 'react-native-nitro-geolocation/background';

const [diagnosis, status] = await Promise.all([
  diagnoseBackgroundLocation(),
  getBackgroundLocationStatus(),
]);

console.log({ diagnosis, status });
```

Review the [reliability contract](../background/reliability-contract.md) before
classifying termination, reboot, or suspension behavior as a library guarantee.

## Open a useful report

Use [GitHub Discussions](https://github.com/jingjing2222/react-native-nitro-geolocation/discussions)
for integration questions and
[GitHub Issues](https://github.com/jingjing2222/react-native-nitro-geolocation/issues/new?template=bug_report.md)
for reproducible defects. This open-source project does not provide an SLA.

Include:

- exact Geolocation, Nitro Modules, React Native, React, and Expo versions;
- iOS/Android/browser version, device or simulator, and CPU architecture;
- CocoaPods/prebuilt/source-build path and whether a clean native rebuild ran;
- minimal main package, `/compat`, or `/background` import and options;
- doctor JSON plus permission/readiness or background diagnosis;
- expected result, actual result, and smallest reproduction steps;
- whether the problem happens in Debug, Release, and a physical device;
- a redacted native log around the failure.

Never post access tokens, HTTP-sync credentials, signing material, personal
addresses, or precise user coordinates. Replace coordinates with coarse or
synthetic values while preserving the relevant accuracy/timestamp metadata.

Do not report a security vulnerability in a public issue. Use the repository's
[private security advisory form](https://github.com/jingjing2222/react-native-nitro-geolocation/security/advisories/new).

## Before closing the investigation

- Reproduce with an exact dependency lockfile.
- Confirm the issue survives a native rebuild.
- Test the minimum permission set for the failing feature.
- Compare behavior with the repository's
  [tested reference stack](./release-readiness.md#tested-reference-stack).
- Add a regression test or consumer scenario when the failure is fixed.
