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

// Position
export interface GeolocationCoordinates {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
}

export interface GeolocationPosition {
  coords: GeolocationCoordinates;
  timestamp: number;
}

// Options
export interface GeolocationOptions {
  timeout?: number;
  maximumAge?: number;
  enableHighAccuracy?: boolean;
}

export interface NitroGeolocation
  extends HybridObject<{ ios: "swift"; android: "kotlin" }> {
  setRNConfiguration(config: RNConfigurationInternal): void;
  requestAuthorization(
    success?: () => void,
    error?: (error: GeolocationError) => void
  ): void;
  getCurrentPosition(
    success: (position: GeolocationPosition) => void,
    error?: (error: GeolocationError) => void,
    options?: GeolocationOptions
  ): void;
}
