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
| Web | Modern API root import and `/compat` supported through `navigator.geolocation`; background location remains native-only |
| New Architecture | Required target; implemented through Nitro Modules |
| Expo Go | Not supported |
| Expo development builds | Supported with native setup |
| Full background tracking/geofencing | Supported through `react-native-nitro-geolocation/background` |

## Directory Positioning

Recommended short description:

```txt
Nitro-powered geolocation for React Native 0.75+ New Architecture apps. Use /compat to replace @react-native-community/geolocation, move to a typed Modern API, or add web foreground support and native background tracking/geofencing.
```

Recommended caveat:

```txt
Targets bare React Native/RN CLI apps with New Architecture enabled, Expo development/custom native builds, and Modern API or `/compat` web through navigator.geolocation. Expo Go and browser background location are not supported.
```

## Pre-Submission Checklist

- README explains when to use the package and when not to use it.
- README includes compat coverage, Modern API and `/compat` web behavior, and Expo limitations.
- npm package has discoverability keywords.
- Repository topics include React Native, geolocation, Nitro, JSI, platform, and Android provider keywords.
- Docs include Expo development build guidance.
- Docs include community and service migration paths.
- Benchmark docs clearly state cached-read and JS-native latency scope.
- Roadmap issue tracks compatibility matrix, extra benchmarks, and real migration examples.
