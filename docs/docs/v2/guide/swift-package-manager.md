---
title: Swift Package Manager
---

# Swift Package Manager

React Native 0.87 introduced a Swift Package Manager (SwiftPM) build path for
iOS. It is optional: CocoaPods remains the supported iOS installation path for
`react-native-nitro-geolocation`.

## Current Compatibility

Do not run `npx react-native spm` in an app that installs this package yet.
The React Native 0.87 SwiftPM autolinker requires every native dependency to
resolve through a compatible `Package.swift`, either shipped by the library or
generated from a supported podspec. The required `react-native-nitro-modules`
peer dependency does not currently ship one.

This package and Nitro Modules also contain a mixed Swift, Objective-C++, and
C++ target with Swift/C++ interop. React Native's generated SwiftPM scaffold
cannot safely translate that target. Running `npx react-native spm scaffold`
does not make this combination supported.

| iOS dependency manager | React Native 0.87 | Status |
| --- | --- | --- |
| CocoaPods | Supported | Recommended |
| SwiftPM-only | Not yet supported | Wait for an official Nitro Modules SwiftPM package |

## Supported RN 0.87 Installation

Install both JavaScript packages normally, then keep the CocoaPods integration
for iOS:

```bash
yarn add react-native-nitro-modules react-native-nitro-geolocation@rc
cd ios
bundle exec pod install
```

Use `pod install` instead of `bundle exec pod install` when the app does not
check in a `Gemfile`. Open the generated `.xcworkspace` and rebuild the native
app.

Android setup is unchanged. The iOS dependency-manager choice does not affect
the package's JavaScript API.

## Avoid Unsupported Workarounds

Do not:

- disable iOS autolinking for `react-native-nitro-modules`;
- add an empty manifest or use a generated scaffold for these mixed-language
  Nitro targets in `node_modules`;
- split the generated Nitro target into independent Swift and C++ targets;
- link the same React or Nitro native symbols through both CocoaPods and
  SwiftPM.

These workarounds can pass package resolution while producing missing native
registrations, duplicate symbols, or configuration-specific linker failures.

## When SwiftPM Becomes Available

SwiftPM-only installation can be documented as supported after all of these
conditions are met:

1. `react-native-nitro-modules` publishes an official SwiftPM product.
2. `react-native-nitro-geolocation` publishes a manifest or binary package that
   preserves Nitro's Swift/C++ interop settings.
3. Debug and Release builds pass on both an iOS simulator and a physical-device
   archive with React Native 0.87.
4. The app can run Modern, `/compat`, and background registration checks
   without CocoaPods products in the link graph.

Until then, choose CocoaPods for apps that use this package. React Native's
[0.87 changelog](https://github.com/facebook/react-native/blob/v0.87.0/CHANGELOG.md)
and the upstream
[Nitro Modules repository](https://github.com/mrousavy/nitro) are the source of
truth for the two prerequisite implementations.
