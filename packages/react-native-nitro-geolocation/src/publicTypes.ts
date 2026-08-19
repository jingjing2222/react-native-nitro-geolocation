import type {
  NitroGeolocation,
  PermissionStatus
} from "./NitroGeolocation.nitro";
import type { CompatGeolocationConfigurationInternal } from "./NitroGeolocationCompat.nitro";
import type {
  AccuracyAuthorization as SchemaAccuracyAuthorization,
  AndroidAccuracyPreset as SchemaAndroidAccuracyPreset,
  AndroidGranularity as SchemaAndroidGranularity,
  CompatGeolocationError as SchemaCompatGeolocationError,
  CompatGeolocationOptions as SchemaCompatGeolocationOptions,
  CompatGeolocationResponse as SchemaCompatGeolocationResponse,
  GeocodedLocation as SchemaGeocodedLocation,
  GeocodingCoordinates as SchemaGeocodingCoordinates,
  GeolocationResponse as SchemaGeolocationResponse,
  Heading as SchemaHeading,
  HeadingOptions as SchemaHeadingOptions,
  IOSAccuracyPreset as SchemaIOSAccuracyPreset,
  IOSActivityType as SchemaIOSActivityType,
  LocationAccuracyOptions as SchemaLocationAccuracyOptions,
  LocationAvailability as SchemaLocationAvailability,
  LocationProviderStatus as SchemaLocationProviderStatus,
  LocationProviderUsed as SchemaLocationProviderUsed,
  LocationSettingsOutcome as SchemaLocationSettingsOutcome,
  LocationSettingsResult as SchemaLocationSettingsResult,
  ReverseGeocodedAddress as SchemaReverseGeocodedAddress
} from "./types";

type NativeGeolocationConfiguration = Parameters<
  NitroGeolocation["setConfiguration"]
>[0];
type NativeLocationProvider = NonNullable<
  NativeGeolocationConfiguration["locationProvider"]
>;

/** API path that delivered a Modern location response. */
export type LocationResponseSource =
  | "currentPosition"
  | "watchPosition"
  | "platformCache"
  | "moduleCache";

/** Descriptive horizontal-accuracy band. It is not an acceptance policy. */
export type LocationQualityBand = "high" | "medium" | "low" | "unknown";

/** Why a delivered response cannot satisfy its timestamp freshness contract. */
export type LocationStaleReason =
  | "maximumAgeExceeded"
  | "futureTimestamp"
  | "invalidTimestamp";

export interface LocationMetadata {
  /** API path that delivered this response. */
  source: LocationResponseSource;
  /** Milliseconds elapsed between the location timestamp and this delivery. */
  age?: number;
  /** `high` is >0m and <=10m, `medium` is <=100m, and `low` is >100m. */
  quality: LocationQualityBand;
  /** Present when timestamp freshness is invalid or violates `maximumAge`. */
  staleReason?: LocationStaleReason;
}

export type GeolocationResponse = SchemaGeolocationResponse & {
  /** Descriptive delivery, age, accuracy, and freshness metadata. */
  metadata?: LocationMetadata;
};
export type LocationProviderStatus = SchemaLocationProviderStatus;
export type LocationSettingsOutcome = SchemaLocationSettingsOutcome;
export type LocationSettingsResult = SchemaLocationSettingsResult;
export type LocationAvailability = SchemaLocationAvailability;

export type LocationReadinessRemediation =
  | "requestPermission"
  | "requestPermissionOrReviewSettings"
  | "reviewPermissionSettings"
  | "enableLocationServices"
  | "enableLocationProvider"
  | "installOrUpdatePlayServices"
  | "enableGoogleLocationAccuracy"
  | "useSupportedEnvironment"
  | "acquirePosition"
  | "retryLocation";

export type LocationCacheReadiness =
  | { available: false }
  | { available: true; timestamp: number; ageMs: number };

/**
 * Read-only location diagnosis assembled from permission, service, provider,
 * availability, and module-cache state.
 */
export interface LocationReadiness {
  ready: boolean;
  permission: PermissionStatus;
  providerStatus: LocationProviderStatus;
  availability: LocationAvailability;
  cache: LocationCacheReadiness;
  remediations: LocationReadinessRemediation[];
}
export type GeocodingCoordinates = SchemaGeocodingCoordinates;
export type GeocodedLocation = SchemaGeocodedLocation;
export type ReverseGeocodedAddress = SchemaReverseGeocodedAddress;
export type AndroidAccuracyPreset = SchemaAndroidAccuracyPreset;
export type AndroidGranularity = SchemaAndroidGranularity;
export type IOSAccuracyPreset = SchemaIOSAccuracyPreset;
export type AccuracyAuthorization = SchemaAccuracyAuthorization;
export type IOSActivityType = SchemaIOSActivityType;
export type LocationAccuracyOptions = SchemaLocationAccuracyOptions;
export type Heading = SchemaHeading;
export type HeadingOptions = SchemaHeadingOptions;

export type CompatGeolocationResponse = SchemaCompatGeolocationResponse;

export type GeolocationCoordinates = GeolocationResponse["coords"];
export type LocationProviderUsed = SchemaLocationProviderUsed;
export type CompatGeolocationError = SchemaCompatGeolocationError;
export type CompatGeolocationOptions = SchemaCompatGeolocationOptions;

export type AuthorizationLevel = NonNullable<
  NativeGeolocationConfiguration["authorizationLevel"]
>;
export type LocationProvider =
  | Exclude<NativeLocationProvider, "android_platform">
  | "android";

export type GeolocationConfiguration = Omit<
  NativeGeolocationConfiguration,
  "autoRequestPermission" | "locationProvider"
> & {
  /**
   * @deprecated This option is accepted for backward compatibility only.
   * `setConfiguration()` does not request permission. Call
   * `requestPermission()` explicitly when your app is ready to show the native
   * permission prompt.
   * @default false
   */
  autoRequestPermission?: boolean;

  /**
   * Android location provider.
   *
   * `auto` and `playServices` prefer Google Play Services fused location when
   * available and fall back to Android's platform provider. Use `android` to
   * force Android's platform `LocationManager` path.
   */
  locationProvider?: LocationProvider;
};

export type CompatGeolocationConfiguration = Omit<
  CompatGeolocationConfigurationInternal,
  "locationProvider"
> & {
  /**
   * Android location provider compatibility option.
   *
   * Preserved for the legacy `/compat` configuration surface. Use the Modern
   * API root import when you need Android fused/provider selection.
   */
  locationProvider?: LocationProvider;
};
