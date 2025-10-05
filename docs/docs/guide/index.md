# Introduction

The original [`@react-native-community/geolocation`](https://github.com/michalchudziak/react-native-geolocation) package was once the standard way to access device location in React Native apps.
However, its last update was in **2024**.

With the React Native ecosystem moving toward **TurboModules**, **Fabric**, and **JSI-based architecture**, the classic bridge implementation of `@react-native-community/geolocation` no longer provides the best performance or developer experience.

This project — **Nitro Geolocation** — is a modern reimplementation of that library, designed for the **Nitro Module** system.
It aims to provide the same familiar API surface while delivering:

- 🚀 **Faster performance** through direct JSI bindings
- 📱 **Improved native consistency** across Android and iOS
- 🔁 **Seamless migration** from `@react-native-community/geolocation`
- 🧩 **TypeScript-first** developer experience
- 🔄 **100% API compatibility** — Nitro Geolocation can be used as a **drop-in replacement**, fully substituting `@react-native-community/geolocation` without any code changes

Whether you're upgrading an existing app or building a new one using the latest React Native architecture, **Nitro Geolocation** gives you the same simplicity — now with modern internals.

## Motivation

The motivation behind Nitro Geolocation is simple:
React Native has evolved, but some of its core community modules haven’t kept up.

`@react-native-community/geolocation` was originally based on the **legacy bridge**, which introduces several issues:

- Extra serialization overhead between JS and native layers
- Delayed responses when retrieving high-frequency location updates
- Difficulties integrating with concurrent React or Fabric
- Limited TypeScript support and inconsistent permission handling

As React Native officially embraces **JSI** and **TurboModules**, maintaining legacy modules becomes increasingly inefficient.
That’s why this project started — to **modernize the Geolocation API** using the current runtime architecture.

## Why Nitro Module?

The **Nitro Module** system provides the next generation of native modules for React Native.
Instead of relying on the old bridge (JSON serialization between JS and native), Nitro Modules communicate directly through **JSI (JavaScript Interface)**.

This enables:

- ⚡ **Zero-copy native calls** — no bridge overhead
- 🧠 **Synchronous APIs** for critical paths
- 🔧 **Better integration** with the new Fabric renderer
- 🧩 **Cross-platform consistency** and simpler maintenance

In short, Nitro Geolocation isn’t just a rewrite — it’s a **forward-compatible foundation** for future React Native development, **fully compatible with existing `@react-native-community/geolocation` usage**.
