import type { HybridObject } from "react-native-nitro-modules";

// Configuration
export type AuthorizationLevel = "always" | "whenInUse" | "auto";
export type LocationProvider = "playServices" | "android" | "auto";

export interface RNConfiguration {
  skipPermissionRequests: boolean;
  authorizationLevel?: AuthorizationLevel;
  enableBackgroundLocationUpdates?: boolean;
  locationProvider?: LocationProvider;
}

export interface NitroGeolocation
  extends HybridObject<{ ios: "swift"; android: "kotlin" }> {
  setRNConfiguration(config: RNConfiguration): void;
}
