---
pageType: home

hero:
  name: React Native Nitro Geolocation
  text: Nitro-powered native geolocation
  tagline: Replace community geolocation with /compat, then move to a typed Modern API.
  actions:
    - theme: brand
      text: Introduction
      link: /guide/
    - theme: alt
      text: Quick Start
      link: /guide/quick-start/
  image:
    src: /logo.png
    alt: Nitro Geolocation Logo

features:
  - title: Simple Functional API
    details: Direct function calls and a single hook for tracking. No complex abstractions, just simple and effective.
    icon: 🎯
  - title: Fully native implementation
    details: Access device geolocation data through JSI and Nitro Modules for maximum performance.
    icon: 📡
  - title: Drop-in replacement (via /compat)
    details: Compat API is drop-in compatible with the core native @react-native-community/geolocation API for easy migration.
    icon: 🔁
  - title: Consistent Android & iOS behavior
    details: Unified permission handling, background location consistency, and improved accuracy tuning.
    icon: 📱
  - title: Direct JSI communication
    details: Built with Nitro Modules, enabling direct JS-to-native calls without bridge serialization overhead.
    icon: ⚙️
  - title: Automatic cleanup
    details: useWatchPosition automatically manages subscriptions with component lifecycle—no manual cleanup needed.
    icon: 🧹
  - title: DevTools Plugin for Rozenite
    details: Mock locations in development with an interactive map interface, city presets, and keyboard controls.
    icon: 🛠️
  - title: TypeScript ready
    details: Full type definitions for all APIs with complete type inference for functions and hooks.
    icon: 📘
  - title: Easy integration
    details: Works in bare React Native, RN CLI, Expo development builds, and other custom native builds.
    icon: 🧩
---
