// Public API types (compatible with @react-native-community/geolocation)
export type AuthorizationLevel = "always" | "whenInUse" | "auto";
export type LocationProvider = "playServices" | "android" | "auto";
export type NullableDouble = number | null;

/**
 * User-facing geolocation configuration.
 * This uses "android" instead of "android_platform" for better DX.
 */
export interface ModernGeolocationConfiguration {
  /**
   * Automatically request location permission when GeolocationProvider mounts.
   * @default false
   */
  autoRequestPermission?: boolean;

  /**
   * iOS: Authorization level
   */
  authorizationLevel?: AuthorizationLevel;

  /**
   * iOS: Enable background location updates.
   */
  enableBackgroundLocationUpdates?: boolean;

  /**
   * Android: Location provider
   */
  locationProvider?: LocationProvider;
}

export interface GeolocationConfiguration {
  skipPermissionRequests: boolean;
  authorizationLevel?: AuthorizationLevel;
  enableBackgroundLocationUpdates?: boolean;
  locationProvider?: LocationProvider;
}

export interface GeolocationCoordinates {
  latitude: number;
  longitude: number;
  altitude: NullableDouble;
  accuracy: number;
  altitudeAccuracy: NullableDouble;
  heading: NullableDouble;
  speed: NullableDouble;
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

export interface GeolocationOptions {
  timeout?: number;
  maximumAge?: number;
  enableHighAccuracy?: boolean;
  interval?: number;
  fastestInterval?: number;
  distanceFilter?: number;
  useSignificantChanges?: boolean;
}
