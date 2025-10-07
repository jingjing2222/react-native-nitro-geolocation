import type { HybridObject } from "react-native-nitro-modules";
import type {
  GeolocationError,
  GeolocationOptions,
  GeolocationResponse
} from "./types";

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

export interface NitroGeolocation
  extends HybridObject<{ ios: "swift"; android: "kotlin" }> {
  setRNConfiguration(config: RNConfigurationInternal): void;
  requestAuthorization(
    success?: () => void,
    error?: (error: GeolocationError) => void
  ): void;
  getCurrentPosition(
    success: (position: GeolocationResponse) => void,
    error?: (error: GeolocationError) => void,
    options?: GeolocationOptions
  ): void;
  watchPosition(
    success: (position: GeolocationResponse) => void,
    error?: (error: GeolocationError) => void,
    options?: GeolocationOptions
  ): number;
  clearWatch(watchId: number): void;
  stopObserving(): void;
}
