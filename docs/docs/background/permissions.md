# Permissions

```ts
import {
  checkBackgroundPermission,
  requestBackgroundPermission,
  openAppLocationSettings,
} from 'react-native-nitro-geolocation/background';

const status = await checkBackgroundPermission();
const requested = await requestBackgroundPermission();

if (requested.needsSettingsRedirect) {
  await openAppLocationSettings();
}
```

`foreground` and `background` are separate because Android and iOS gate background access differently.
