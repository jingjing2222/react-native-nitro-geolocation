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

The **Nitro Module** system provides the next generation of native modules for React Native.
Instead of using the bridge-based approach (JSON serialization between JS and native), Nitro Modules communicate directly through **JSI (JavaScript Interface)**.

This enables:

- ⚡ **Direct native calls** — reduced overhead
- 🧠 **Synchronous APIs** for critical paths
- 🔧 **Better integration** with the new Fabric renderer
- 🧩 **Cross-platform consistency** and simpler maintenance

In short, Nitro Geolocation builds on the proven API design of `@react-native-community/geolocation` while leveraging the new React Native architecture, providing a **forward-compatible foundation** with **100% API compatibility**.
