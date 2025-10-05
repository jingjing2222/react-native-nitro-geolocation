import type { HybridObject } from "react-native-nitro-modules";

// Configuration
export interface RNConfiguration {
  skipPermissionRequests: boolean;
  authorizationLevel?: "always" | "whenInUse" | "auto";
  enableBackgroundLocationUpdates?: boolean;
  locationProvider?: "playServices" | "android" | "auto";
}

export interface NitroGeolocation
  extends HybridObject<{ ios: "swift"; android: "kotlin" }> {
  setRNConfiguration(config: RNConfiguration): void;
}
