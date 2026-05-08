import type { NitroGeolocation } from "./NitroGeolocation.nitro";
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
  ReverseGeocodedAddress as SchemaReverseGeocodedAddress
} from "./types";

type NativeGeolocationConfiguration = Parameters<
  NitroGeolocation["setConfiguration"]
>[0];
type NativeLocationProvider = NonNullable<
  NativeGeolocationConfiguration["locationProvider"]
>;

export type GeolocationResponse = SchemaGeolocationResponse;
export type LocationProviderStatus = SchemaLocationProviderStatus;
export type LocationAvailability = SchemaLocationAvailability;
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
   * `auto` currently uses Android's platform `LocationManager` by default.
   * Set `playServices` explicitly to use Google Play Services fused location.
   */
  locationProvider?: LocationProvider;
};

/**
 * @deprecated Use `GeolocationConfiguration` instead.
 * This alias is kept only for backward compatibility.
 */
export type ModernGeolocationConfiguration = GeolocationConfiguration;

export type CompatGeolocationConfiguration = Omit<
  CompatGeolocationConfigurationInternal,
  "locationProvider"
> & {
  /**
   * Android location provider.
   *
   * `auto` currently uses Android's platform `LocationManager` by default.
   * Set `playServices` explicitly to use Google Play Services fused location.
   */
  locationProvider?: LocationProvider;
};
