// Shared Nitro schema structs. Public entry points re-export inferred aliases
// from the Nitro/Compat specs in publicTypes.ts.
export type LocationProviderUsed =
  | "fused"
  | "gps"
  | "network"
  | "passive"
  | "unknown";
export type NullableDouble = number | null;
export type AndroidAccuracyPreset = "high" | "balanced" | "low" | "passive";
export type AndroidGranularity = "permission" | "coarse" | "fine";
export type IOSAccuracyPreset =
  | "bestForNavigation"
  | "best"
  | "nearestTenMeters"
  | "hundredMeters"
  | "kilometer"
  | "threeKilometers"
  | "reduced";
export type AccuracyAuthorization = "full" | "reduced" | "unknown";
export type IOSActivityType =
  | "other"
  | "automotiveNavigation"
  | "fitness"
  | "otherNavigation"
  | "airborne";

export interface LocationAccuracyOptions {
  android?: AndroidAccuracyPreset;
  ios?: IOSAccuracyPreset;
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
  mocked?: boolean;
  provider?: LocationProviderUsed;
}

export interface LocationAvailability {
  available: boolean;
  reason?: string;
}

export interface Heading {
  magneticHeading: number;
  trueHeading?: number;
  accuracy?: number;
  timestamp: number;
}

export interface HeadingOptions {
  headingFilter?: number;
}

export type ActiveWatchKind = "position" | "heading";

/** Snapshot entry returned by getActiveWatches(). */
export interface ActiveWatch {
  /** Subscription token accepted by unwatch(). */
  token: string;
  /** Sensor stream owned by the subscription. */
  kind: ActiveWatchKind;
}

export interface GeocodingCoordinates {
  latitude: number;
  longitude: number;
}

export interface GeocodedLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface ReverseGeocodedAddress {
  country?: string;
  region?: string;
  city?: string;
  district?: string;
  street?: string;
  postalCode?: string;
  formattedAddress?: string;
}

/**
 * Native provider/settings status.
 *
 * Android includes device-level location services, provider availability, and
 * Google Location Accuracy when Google Play Services exposes it.
 *
 * iOS includes only Core Location service availability and app background
 * location mode. Android-specific provider fields are `undefined` on iOS.
 */
export interface LocationProviderStatus {
  /** Android system location switch, or iOS Core Location services state. */
  locationServicesEnabled: boolean;

  /**
   * iOS: whether `UIBackgroundModes` contains `location`.
   * Android: whether background location permission is granted.
   */
  backgroundModeEnabled: boolean;

  /** Android-only GPS provider availability. Undefined on iOS. */
  gpsAvailable?: boolean;

  /** Android-only network provider availability. Undefined on iOS. */
  networkAvailable?: boolean;

  /** Android-only passive provider availability. Undefined on iOS. */
  passiveAvailable?: boolean;

  /** Android-only Google Play Services availability. Undefined on iOS. */
  googlePlayServicesAvailable?: boolean;

  /**
   * Android-only Google Location Accuracy state when Google Play Services
   * exposes it. Undefined on iOS or when unavailable.
   */
  googleLocationAccuracyEnabled?: boolean;
}

/** Expected outcome of a location settings resolution request. */
export type LocationSettingsOutcome =
  | "satisfied"
  | "cancelled"
  | "unavailable"
  | "activityMissing";

/**
 * Deterministic result from `requestLocationSettings()`.
 *
 * Expected platform outcomes resolve through this object. Errors are reserved
 * for failures of the request itself, such as a concurrent request.
 */
export interface LocationSettingsResult {
  outcome: LocationSettingsOutcome;
  providerStatus: LocationProviderStatus;
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
  accuracy?: LocationAccuracyOptions;
  interval?: number;
  fastestInterval?: number;
  distanceFilter?: number;
  useSignificantChanges?: boolean;
  activityType?: IOSActivityType;
  pausesLocationUpdatesAutomatically?: boolean;
  showsBackgroundLocationIndicator?: boolean;
}
