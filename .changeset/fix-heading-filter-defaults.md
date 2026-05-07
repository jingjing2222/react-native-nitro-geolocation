---
"react-native-nitro-geolocation": patch
---

Fix iOS heading firehose: default `headingFilter` to 1° (Apple's documented default) instead of 0°, and apply the filter on the same `trueHeading ?? magneticHeading` value JS consumers actually receive.

Before this fix, callers who didn't supply `headingFilter` (or whose options didn't reach native) hit `kCLHeadingFilterNone` (-1) — every CLHeading tick fired the success callback, producing sub-degree firehose updates on a stationary device. The JS-side delta gate also compared on `magneticHeading` only, so a non-zero filter value could still pass while JS-visible `trueHeading` deltas were tiny.
