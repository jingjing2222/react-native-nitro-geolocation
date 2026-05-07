---
"react-native-nitro-geolocation": patch
---

Fix iOS heading firehose: default `headingFilter` to 1° (Apple's documented default) instead of 0°.

Before this fix, callers who didn't supply `headingFilter` (or whose options didn't reach native) hit `kCLHeadingFilterNone` (-1) — every CLHeading tick fired the success callback, producing sub-degree firehose updates on a stationary device.
