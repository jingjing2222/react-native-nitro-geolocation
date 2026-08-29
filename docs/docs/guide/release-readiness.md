---
title: Release readiness
description: Understand the 2.0 RC policy, declared support, tested reference stack, known limits, and ship checklist.
---

# Release readiness

React Native Nitro Geolocation 2.0 is currently a **release candidate**. Use it
to integrate and validate 2.0 contracts, but treat production approval as your
application team's decision after testing the exact devices and features you
ship. The project does not provide an SLA or guarantee that an RC is free of
contract corrections before 2.0 stable.

## RC policy

- `@rc` is a moving npm tag for evaluation. Pin an exact RC in a lockfile used
  for QA or release approval.
- A later RC can include breaking corrections when they are required to make the
  stable 2.0 contract coherent. Review the package changelog before updating.
- Stable 1.x documentation remains at the unversioned site. 2.0 RC documentation
  is under `/v2/`.
- Keep a known-good 1.x release branch and lockfile until the 2.0 upgrade and
  release gates pass in your application.
- There is no date-based GA promise. The project will mark 2.0 stable after the
  public contracts are frozen, release builds and consumer contracts pass on
  both native platforms, versioned docs match the package, and release prebuilts
  are validated.

Pin the repository's current reference combination:

```bash
yarn add react-native-nitro-modules@0.35.10 react-native-nitro-geolocation@2.0.0-rc.3
```

## Declared support

Declared support is the package contract, not a claim that every possible
combination is continuously exercised.

| Area | Declared scope | Boundary |
| --- | --- | --- |
| React Native | 0.75 or newer | New Architecture and Nitro Modules required |
| React | 18 or newer | Follow the compatible version for the selected React Native release |
| Expo | SDK 51 or newer as an optional peer | Development/custom native builds only; Expo Go unsupported |
| iOS dependency manager | CocoaPods | React Native 0.87 SwiftPM-only unsupported until Nitro Modules provides a compatible package |
| Android build | Consumer app's supported Android toolchain | Native permissions and foreground-service rules vary by OS level |
| Native foreground | iOS and Android | Test permission and provider behavior on target devices |
| Web foreground | Modern root and `/compat` through `navigator.geolocation` | Secure-context and browser permission rules apply |
| Background | iOS and Android through `/background` | Native-only and best effort under OS lifecycle policy |
| Prebuilts | Matching release assets when compatible | Android requires matching React Native and Nitro major/minor versions; source fallback otherwise |

## Tested reference stack

The 2.0.0-rc.3 repository currently builds and runs its consumer contracts with
this reference stack. This is evidence of the continuously exercised path, not
the full peer range.

| Component | Repository reference | Verification |
| --- | --- | --- |
| React Native | 0.81.1 | Example app typecheck, native release builds, and E2E flows |
| React | 19.1.0 | Example application |
| Nitro Modules | 0.35.10 | Generated bindings, unit tests, native builds |
| Android | API 34 arm64 Google APIs emulator | Release foreground, background long-run, GPS-offline, web fallback, and regression flows |
| iOS | Available iPhone simulator on the self-hosted Xcode runner | CocoaPods Release build, foreground/background long-run, and web fallback flows |
| JavaScript toolchain | Node 24.18.0, Yarn 4.9.4 | CI and E2E bootstrap |
| Expo config plugin | Expo 57 development dependency | Plugin/type tests; validate a real development build for the SDK used by your app |

Reference last reviewed for `2.0.0-rc.3` on **2026-08-27**. Consult the current
example package and E2E workflow if this page and the installed release differ.

## Known limits

- Expo Go cannot load the native Nitro bindings.
- SwiftPM-only iOS projects are not supported; use CocoaPods.
- Browser builds support foreground geolocation only. The `/background` web
  entry is import-safe but reports unsupported behavior.
- Background delivery is best effort. Termination, reboot, iOS suspension,
  Android OEM restrictions, permission changes, and device settings affect what
  can be delivered. Read the [reliability contract](../background/reliability-contract.md).
- Prebuilt fallback can turn an install into a source build. Validate both the
  selected artifact path and your CI's native build prerequisites.
- Geocoding and heading have platform/provider constraints; offline GPS does not
  imply offline geocoding. See the [GPS/offline recipe](./gps-offline-recipe.md).
- The library does not choose your battery/accuracy policy. Validate intervals,
  distance filters, accuracy, retention, and disclosure against the product use
  case and target devices.

Track newly reported release-candidate issues in
[GitHub Issues](https://github.com/jingjing2222/react-native-nitro-geolocation/issues).

## Ship checklist

- [ ] Exact Geolocation, Nitro Modules, React Native, and Expo versions are
      locked and recorded in release evidence.
- [ ] `nitro-geolocation doctor` passes after native project generation.
- [ ] The app handles foreground grant, approximate/reduced grant, denial,
      restriction, settings changes, timeout, and provider unavailability.
- [ ] Current, cached, and watched positions are tested according to the
      product's freshness and accuracy rules.
- [ ] Every enabled background feature passes on physical devices and target OS
      versions; unsupported OS lifecycle claims are not shown to users.
- [ ] Background event recovery and server processing are idempotent.
- [ ] Only permissions required by enabled features are declared and requested
      at a user-understandable moment.
- [ ] Location retention, deletion, backup, sync, credentials, store disclosures,
      and incident handling pass the [privacy review](./privacy-compliance.md).
- [ ] Release-build consumer flows cover the product's critical path; use the
      [consumer E2E contract kit](./consumer-e2e-contract-kit.md) as a baseline.
- [ ] Support reports can include the evidence in
      [Troubleshooting](./troubleshooting.md) without exposing precise user
      coordinates or credentials.
- [ ] A rollback build and any persistent-data compatibility strategy have been
      tested before rollout.

For 1.x applications, complete [Upgrade from 1.x](./upgrade-from-v1.md) before
using this checklist as the final release gate.
