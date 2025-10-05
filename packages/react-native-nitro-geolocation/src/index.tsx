import { NitroModules } from "react-native-nitro-modules";
import type { NitroGeolocation, RNConfigurationInternal } from "./NitroGeolocation.nitro";

const NitroGeolocationHybridObject =
  NitroModules.createHybridObject<NitroGeolocation>("NitroGeolocation");

// Public API types (compatible with @react-native-community/geolocation)
export type AuthorizationLevel = "always" | "whenInUse" | "auto";
export type LocationProvider = "playServices" | "android" | "auto";

export interface RNConfiguration {
  skipPermissionRequests: boolean;
  authorizationLevel?: AuthorizationLevel;
  enableBackgroundLocationUpdates?: boolean;
  locationProvider?: LocationProvider;
}

function mapConfigToInternal(config: RNConfiguration): RNConfigurationInternal {
  return {
    skipPermissionRequests: config.skipPermissionRequests,
    authorizationLevel: config.authorizationLevel,
    enableBackgroundLocationUpdates: config.enableBackgroundLocationUpdates,
    locationProvider: config.locationProvider === "android" ? "android_platform" : config.locationProvider
  };
}

export function setRNConfiguration(config: RNConfiguration): void {
  NitroGeolocationHybridObject.setRNConfiguration(mapConfigToInternal(config));
}

// Default export for compatibility
const Geolocation = {
  setRNConfiguration
};

export default Geolocation;
