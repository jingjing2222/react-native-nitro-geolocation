/**
 * Browser implementation for the Modern API.
 *
 * This entry intentionally avoids Nitro native imports so web bundlers can use
 * the package root without loading native bindings.
 */

export * from "./web";
export * from "./background/index.web";

export type {
  PermissionStatus,
  LocationRequestOptions,
  LocationSettingsOptions,
  LocationError
} from "./NitroGeolocation.nitro";

export type {
  GeolocationResponse,
  GeolocationCoordinates,
  LocationProviderStatus,
  LocationAvailability,
  GeocodingCoordinates,
  GeocodedLocation,
  ReverseGeocodedAddress,
  AndroidAccuracyPreset,
  AndroidGranularity,
  IOSAccuracyPreset,
  AccuracyAuthorization,
  IOSActivityType,
  LocationAccuracyOptions,
  Heading,
  HeadingOptions,
  AuthorizationLevel,
  LocationProvider,
  LocationProviderUsed,
  GeolocationConfiguration,
  ModernGeolocationConfiguration
} from "./publicTypes";

export * from "./utils";
