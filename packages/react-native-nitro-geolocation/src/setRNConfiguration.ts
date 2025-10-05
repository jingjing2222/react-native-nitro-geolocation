import type { RNConfigurationInternal } from "./NitroGeolocation.nitro";
import { NitroGeolocationHybridObject } from "./NitroGeolocationModule";
import type { RNConfiguration } from "./types";

// Mapping layer: convert "android" to "android_platform" for C++
function mapConfigToInternal(config: RNConfiguration): RNConfigurationInternal {
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

export function setRNConfiguration(config: RNConfiguration): void {
  NitroGeolocationHybridObject.setRNConfiguration(mapConfigToInternal(config));
}
