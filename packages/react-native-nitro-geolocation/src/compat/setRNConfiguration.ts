import type { RNConfigurationInternal } from "../NitroGeolocationCompat.nitro";
import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
import type { GeolocationConfiguration } from "../types";

// Mapping layer: convert "android" to "android_platform" for C++
function mapConfigToInternal(
  config: GeolocationConfiguration
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

export function setRNConfiguration(config: GeolocationConfiguration): void {
  NitroGeolocationHybridObject.setRNConfiguration(mapConfigToInternal(config));
}
