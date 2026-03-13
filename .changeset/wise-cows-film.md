---
"react-native-nitro-geolocation": minor
---

Update the package for Nitro Modules 0.35.

- Regenerate `nitrogen/generated/**` with Nitro 0.35-compatible bindings
- Update Android JNI bootstrap to use `facebook::jni::initialize(...)` and `registerAllNatives()`
- Relax the `react-native-nitro-modules` peer dependency range to `*`
