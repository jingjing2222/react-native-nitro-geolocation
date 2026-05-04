---
"react-native-nitro-geolocation": patch
"@react-native-nitro-geolocation/rozenite-plugin": patch
---

Modern 위치 응답에 `mocked`와 `provider` 메타데이터를 추가하고 Android/iOS 네이티브 매핑을 반영합니다.
Compat API는 drop-in replacement 계약을 유지하도록 기존 응답 shape를 그대로 둡니다.
Rozenite DevTools의 mock 위치 응답에도 동일한 메타데이터를 포함합니다.
