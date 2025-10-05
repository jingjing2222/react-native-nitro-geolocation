// Public API types (compatible with @react-native-community/geolocation)
export type AuthorizationLevel = "always" | "whenInUse" | "auto";
export type LocationProvider = "playServices" | "android" | "auto";

export interface RNConfiguration {
  skipPermissionRequests: boolean;
  authorizationLevel?: AuthorizationLevel;
  enableBackgroundLocationUpdates?: boolean;
  locationProvider?: LocationProvider;
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

export interface GeolocationPosition {
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
