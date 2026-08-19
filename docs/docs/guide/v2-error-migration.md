---
title: 2.0 Error Migration
---

# 2.0 Error Migration

React Native Nitro Geolocation 2.0 replaces numeric error codes in the Modern
API with readable string discriminants. This is a Modern API change only. The
`/compat` entry point keeps the W3C-style numeric `1`, `2`, and `3` contract.

## Update comparisons

Keep comparisons against `LocationErrorCode` instead of copying either the old
number or the new string into application code:

```diff
 import {
   LocationErrorCode,
   getCurrentPosition
 } from 'react-native-nitro-geolocation';

 try {
   await getCurrentPosition();
 } catch (error) {
-  if ((error as { code?: number }).code === 1) {
+  if (
+    (error as { code?: string }).code ===
+    LocationErrorCode.PERMISSION_DENIED
+  ) {
     showPermissionHelp();
   }
 }
```

The constants now carry their meaning in logs and serialized data:

| 1.x number | 2.x `LocationErrorCode` | 2.x wire value |
| ---: | --- | --- |
| `-1` | `INTERNAL_ERROR` | `internalError` |
| `1` | `PERMISSION_DENIED` | `permissionDenied` |
| `2` | `POSITION_UNAVAILABLE` | `positionUnavailable` |
| `3` | `TIMEOUT` | `timeout` |
| `4` | `PLAY_SERVICE_NOT_AVAILABLE` | `playServicesUnavailable` |
| `5` | `SETTINGS_NOT_SATISFIED` | `settingsNotSatisfied` |

## Narrow unknown errors

JavaScript can throw any value. Use the exported guard when a catch boundary
needs a trusted location code:

```tsx
import {
  isLocationErrorCode,
  LocationErrorCode
} from 'react-native-nitro-geolocation';

function describeLocationFailure(error: unknown): string {
  const candidate = error as { code?: unknown; message?: unknown };

  if (!isLocationErrorCode(candidate.code)) {
    return 'Unexpected location failure';
  }

  if (candidate.code === LocationErrorCode.TIMEOUT) {
    return 'Location took too long. Try again.';
  }

  return typeof candidate.message === 'string'
    ? candidate.message
    : candidate.code;
}
```

## Migrate persisted errors

Do not reinterpret an old number as a new string. If an app stores Modern API
errors, translate known 1.x values once with the table above, write the 2.x
string, and discard unknown values. The native Android background status store
does this migration automatically for errors recorded by this package.

## Keep `/compat` numeric

No change is required for code imported from
`react-native-nitro-geolocation/compat`:

```tsx
import Geolocation from 'react-native-nitro-geolocation/compat';

Geolocation.getCurrentPosition(
  () => undefined,
  (error) => {
    if (error.code === error.PERMISSION_DENIED) {
      showPermissionHelp();
    }
  }
);
```

Keeping the two contracts separate prevents a Modern-only provider error from
leaking into the browser-compatible surface.
