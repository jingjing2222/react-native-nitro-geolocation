---
"react-native-nitro-geolocation": patch
---

Reduce location, heading, and background-processing hot-path work across
Android, iOS, and Web. Response conversion and metadata allocation are deferred
until delivery, sensor buffers and shared polling are reused, unchanged native
configuration and persistence writes are skipped, and batched background work
avoids repeated serialization, sync admission, and unindexed queue scans.
