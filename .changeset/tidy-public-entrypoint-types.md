---
"react-native-nitro-geolocation": patch
---

Harden the v2 public type boundary by moving shared schemas out of Nitro
codegen declarations, keeping bridge envelopes internal, narrowing
operation-specific options, and exposing stable location availability reason
codes. The root, `/compat`, and `/background` entry points now export every
named supporting type referenced by their public contracts, while legacy
TypeScript `node` module resolution can resolve both public subpaths.
