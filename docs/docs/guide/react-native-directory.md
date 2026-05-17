---
title: React Native Directory
---

# React Native Directory Submission

Use this checklist before submitting `react-native-nitro-geolocation` to React
Native Directory.

## Support Matrix

| Capability | Status |
| --- | --- |
| iOS | Supported |
| Android | Supported |
| Web | Modern API root import supported through `navigator.geolocation`; `/compat` remains native-only |
| New Architecture | Required target; implemented through Nitro Modules |
| Expo Go | Not supported |
| Expo development builds | Supported with native setup |
| Full background tracking/geofencing | Not targeted |

## Directory Positioning

Recommended short description:

```txt
Nitro-powered native geolocation for React Native 0.75+. Use /compat to replace @react-native-community/geolocation, then migrate to a typed Modern API with Android settings checks, geocoding, heading, and DevTools mocking.
```

Recommended caveat:

```txt
Targets bare React Native, RN CLI, Expo development/custom native builds, and Modern API web through navigator.geolocation. Expo Go and `/compat` web are not supported.
```

## Pre-Submission Checklist

- README explains when to use the package and when not to use it.
- README includes compat coverage, Modern API web behavior, and Expo limitations.
- npm package has discoverability keywords.
- Repository topics include React Native, geolocation, Nitro, JSI, platform, and Android provider keywords.
- Docs include Expo development build guidance.
- Docs include community and service migration paths.
- Benchmark docs clearly state cached-read and JS-native latency scope.
- Roadmap issue tracks compatibility matrix, `/compat` web fallback, extra benchmarks, and real migration examples.
