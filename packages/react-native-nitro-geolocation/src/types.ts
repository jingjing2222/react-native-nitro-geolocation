// Shared Nitro schema structs. Public entry points re-export inferred aliases
// from the Nitro/Compat specs in publicTypes.ts.
export type LocationProviderUsed =
  | "fused"
  | "gps"
  | "network"
  | "passive"
  | "unknown";
export type NullableDouble = number | null;

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
  mocked?: boolean;
  provider?: LocationProviderUsed;
}

export interface CompatGeolocationResponse {
  coords: GeolocationCoordinates;
  timestamp: number;
}

export interface CompatGeolocationError {
  code: number;
  message: string;
  PERMISSION_DENIED: number;
  POSITION_UNAVAILABLE: number;
  TIMEOUT: number;
}

export interface CompatGeolocationOptions {
  timeout?: number;
  maximumAge?: number;
  enableHighAccuracy?: boolean;
  interval?: number;
  fastestInterval?: number;
  distanceFilter?: number;
  useSignificantChanges?: boolean;
}
