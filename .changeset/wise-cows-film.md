---
"react-native-nitro-geolocation": major
---

Align the package with Nitro Modules 0.35 breaking changes.

- Require `react-native-nitro-modules@>=0.35.0`
- Regenerate `nitrogen/generated/**` with Nitro 0.35-compatible bindings
- Update Android JNI bootstrap to use `facebook::jni::initialize(...)` and `registerAllNatives()`

This is a breaking change for consumers still on Nitro Modules `<0.35.0`.
