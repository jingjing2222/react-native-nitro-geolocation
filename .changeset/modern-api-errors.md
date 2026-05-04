---
"react-native-nitro-geolocation": minor
---

Modern API 위치 오류 계약에 `INTERNAL_ERROR`, `PLAY_SERVICE_NOT_AVAILABLE`, `SETTINGS_NOT_SATISFIED`를 추가합니다. native가 callbacks와 public Promise rejection 모두에 구조화된 `{ code, message }` 오류 분류를 직접 전달하며, `/compat`의 legacy 오류 shape는 유지합니다.
