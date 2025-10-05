# Introduction

The [`@react-native-community/geolocation`](https://github.com/michalchudziak/react-native-geolocation) package has been the standard way to access device location in React Native apps.

With the React Native ecosystem moving toward **TurboModules**, **Fabric**, and **JSI-based architecture**, we saw an opportunity to bring the same familiar API to the new architecture.

This project — **Nitro Geolocation** — is a reimplementation of that library, designed for the **Nitro Module** system.
It provides the same familiar API surface while delivering:

- 🚀 **Faster performance** through direct JSI bindings
- 📱 **Improved native consistency** across Android and iOS
- 🔁 **Seamless migration** from `@react-native-community/geolocation`
- 🧩 **TypeScript-first** developer experience
- 🔄 **100% API compatibility** — Nitro Geolocation can be used as a **drop-in replacement**, fully substituting `@react-native-community/geolocation` without any code changes

Whether you're upgrading an existing app or building a new one using the latest React Native architecture, **Nitro Geolocation** gives you the same simplicity — now with modern internals.

## Motivation

The motivation behind Nitro Geolocation is simple:
React Native has evolved with new architectural capabilities, and we wanted to bring these benefits to the Geolocation API.

`@react-native-community/geolocation` was built on the **bridge-based architecture**, which was the standard at the time. The new JSI-based architecture offers different characteristics:

- Direct communication between JS and native layers
- Support for synchronous APIs when needed
- Better integration with concurrent React and Fabric
- Enhanced TypeScript support and platform consistency

As React Native officially embraces **JSI** and **TurboModules**, we saw an opportunity to bring these capabilities to the Geolocation API while maintaining full compatibility with the existing package.

## Why Nitro Module?

The **Nitro Module** system is a third-party JSI-based native module framework created by Marc Rousavy.
While React Native's official New Architecture (TurboModules) also uses JSI, Nitro offers a different approach with:

- 🛠️ **Simpler code generation** — less boilerplate than TurboModules
- 📘 **Enhanced type safety** — stronger TypeScript and C++ type guarantees
- ⚡ **Direct C++ bindings** — streamlined JSI interface without additional layers
- 🎯 **Focused DX** — developer-friendly API for building JSI modules

For this Geolocation implementation, Nitro provided a cleaner path to achieve:

- Direct native calls with reduced overhead
- Synchronous APIs when needed
- Better integration with modern React Native
- Cross-platform consistency

In short, Nitro Geolocation builds on the proven API design of `@react-native-community/geolocation` while leveraging Nitro's JSI capabilities, providing a **forward-compatible foundation** with **100% API compatibility**.
