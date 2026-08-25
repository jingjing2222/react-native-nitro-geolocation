# Permissions

```ts
import {
  checkBackgroundPermission,
  openAppLocationSettings,
  requestBackgroundPermission,
} from 'react-native-nitro-geolocation/background';

export async function requestBackgroundAccess() {
  const requested = await requestBackgroundPermission();

  if (requested.needsSettingsRedirect) {
    // Android 11+ may already have opened app settings. On iOS, show your own
    // explanation before sending denied/restricted users to settings.
    // await openAppLocationSettings();
    return requested;
  }

  return requested;
}

export async function refreshBackgroundAccessAfterResume() {
  return checkBackgroundPermission();
}
```

`foreground` and `background` are separate because Android and iOS gate
background access differently. `needsSettingsRedirect` means the app still needs
a settings or app-resume round-trip before background tracking can start. On
Android 11+, `requestBackgroundPermission()` can open the app settings screen
because the platform no longer allows inline background-location prompts. On
iOS, it can also remain true until Always authorization is granted; use
`openAppLocationSettings()` after explaining why Always access is required.
Call `checkBackgroundPermission()` again from your app-resume path.
