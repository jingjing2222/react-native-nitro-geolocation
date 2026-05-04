import type { RNConfigurationInternal } from "../NitroGeolocationCompat.nitro";
import { NitroGeolocationHybridCompatObject } from "../NitroGeolocationModule";
import type { CompatGeolocationConfiguration } from "../publicTypes";

// Mapping layer: convert "android" to "android_platform" for C++
function mapConfigToInternal(
  config: CompatGeolocationConfiguration
): RNConfigurationInternal {
  return {
    skipPermissionRequests: config.skipPermissionRequests,
    authorizationLevel: config.authorizationLevel,
    enableBackgroundLocationUpdates: config.enableBackgroundLocationUpdates,
    locationProvider:
      config.locationProvider === "android"
        ? "android_platform"
        : config.locationProvider
  };
}

export function setRNConfiguration(
  config: CompatGeolocationConfiguration
): void {
  NitroGeolocationHybridCompatObject.setRNConfiguration(
    mapConfigToInternal(config)
  );
}
