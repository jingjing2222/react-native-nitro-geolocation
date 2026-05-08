import type { HybridObject } from "react-native-nitro-modules";
import type {
  CompatGeolocationError,
  CompatGeolocationOptions,
  CompatGeolocationResponse
} from "./types";

// Configuration - Internal (for C++ codegen, avoiding ANDROID macro conflict)
export type AuthorizationLevelInternal = "always" | "whenInUse" | "auto";
export type LocationProviderInternal =
  | "playServices"
  | "android_platform"
  | "auto";

export interface CompatGeolocationConfigurationInternal {
  skipPermissionRequests: boolean;
  authorizationLevel?: AuthorizationLevelInternal;
  enableBackgroundLocationUpdates?: boolean;
  locationProvider?: LocationProviderInternal;
}

export interface NitroGeolocationCompat
  extends HybridObject<{ ios: "swift"; android: "kotlin" }> {
  setRNConfiguration(config: CompatGeolocationConfigurationInternal): void;
  requestAuthorization(
    success?: () => void,
    error?: (error: CompatGeolocationError) => void
  ): void;
  getCurrentPosition(
    success: (position: CompatGeolocationResponse) => void,
    options: CompatGeolocationOptions,
    error?: (error: CompatGeolocationError) => void
  ): void;
  watchPosition(
    success: (position: CompatGeolocationResponse) => void,
    options: CompatGeolocationOptions,
    error?: (error: CompatGeolocationError) => void
  ): number;
  clearWatch(watchId: number): void;
  stopObserving(): void;
}
