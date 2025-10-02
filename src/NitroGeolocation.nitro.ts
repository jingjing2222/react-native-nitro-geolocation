import type { HybridObject } from "react-native-nitro-modules";

export interface GeolocationConfiguration {
  skipPermissionRequests: boolean;
  authorizationLevel?: "always" | "whenInUse" | "auto";
  locationProvider?: "playServices" | "android" | "auto";
  enableBackgroundLocationUpdates?: boolean;
}

export interface GeolocationOptions {
  timeout?: number;
  maximumAge?: number;
  enableHighAccuracy?: boolean;
  distanceFilter?: number;
  useSignificantChanges?: boolean;
  interval?: number;
  fastestInterval?: number;
}

export interface GeolocationCoordinates {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
}

export interface GeolocationResponse {
  coords: GeolocationCoordinates;
  timestamp: number;
}

export interface GeolocationError {
  code: number;
  message: string;
  PERMISSION_DENIED: number;
  POSITION_UNAVAILABLE: number;
  TIMEOUT: number;
}

export interface NitroGeolocation
  extends HybridObject<{ ios: "swift"; android: "kotlin" }> {
  /**
   * Sets configuration options that will be used in all location requests.
   */
  setRNConfiguration(config: GeolocationConfiguration): void;

  /**
   * Request suitable Location permission.
   */
  requestAuthorization(): Promise<void>;

  /**
   * Invokes the success callback once with the latest location info.
   */
  getCurrentPosition(
    success: (position: GeolocationResponse) => void,
    error?: (error: GeolocationError) => void,
    options?: GeolocationOptions,
  ): void;

  /**
   * Starts watching the device's position and returns a watch ID.
   */
  watchPosition(
    success: (position: GeolocationResponse) => void,
    error?: (error: GeolocationError) => void,
    options?: GeolocationOptions,
  ): number;

  /**
   * Clears the watch started by watchPosition.
   */
  clearWatch(watchID: number): void;

  /**
   * Stops observing location changes (deprecated).
   */
  stopObserving(): void;
}
