import type { HybridObject } from "react-native-nitro-modules";

// Configuration - Internal (for C++ codegen, avoiding ANDROID macro conflict)
export type AuthorizationLevelInternal = "always" | "whenInUse" | "auto";
export type LocationProviderInternal =
  | "playServices"
  | "android_platform"
  | "auto";

export interface RNConfigurationInternal {
  skipPermissionRequests: boolean;
  authorizationLevel?: AuthorizationLevelInternal;
  enableBackgroundLocationUpdates?: boolean;
  locationProvider?: LocationProviderInternal;
}

// Error
export interface GeolocationError {
  code: number;
  message: string;
  PERMISSION_DENIED: number;
  POSITION_UNAVAILABLE: number;
  TIMEOUT: number;
}

export interface NitroGeolocation
  extends HybridObject<{ ios: "swift"; android: "kotlin" }> {
  setRNConfiguration(config: RNConfigurationInternal): void;
  requestAuthorization(
    success?: () => void,
    error?: (error: GeolocationError) => void
  ): void;
}
