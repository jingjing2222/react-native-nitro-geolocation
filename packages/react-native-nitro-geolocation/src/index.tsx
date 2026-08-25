/**
 * Geolocation API for React Native.
 *
 * This is the main entry point for the functional API.
 * For compat usage, use: import Geolocation from 'react-native-nitro-geolocation/compat'
 *
 * @example
 * ```tsx
 * import {
 *   setConfiguration,
 *   getCurrentPosition,
 *   requestPermission,
 *   useWatchPosition
 * } from 'react-native-nitro-geolocation';
 *
 * // Set configuration at app startup
 * setConfiguration({
 *   authorizationLevel: 'whenInUse',
 *   enableBackgroundLocationUpdates: false,
 *   locationProvider: 'auto'
 * });
 *
 * // Request permission
 * async function setup() {
 *   const status = await requestPermission();
 *   if (status === 'granted') {
 *     const position = await getCurrentPosition({
 *       accuracy: { android: 'high', ios: 'best' }
 *     });
 *     console.log('Position:', position);
 *   }
 * }
 *
 * // Continuous tracking in React component
 * function LiveTracking() {
 *   const { position, error, isWatching } = useWatchPosition({
 *     enabled: true,
 *     accuracy: { android: 'high', ios: 'best' },
 *     distanceFilter: 10
 *   });
 *
 *   if (!isWatching) return <Text>Not watching</Text>;
 *   if (error) return <Text>Error: {error.message}</Text>;
 *   if (!position) return <Text>Waiting...</Text>;
 *
 *   return <Text>Lat: {position.coords.latitude}</Text>;
 * }
 * ```
 */

// Core API functions
export {
  setConfiguration,
  checkPermission,
  getPermissionDetails,
  requestPermission,
  hasServicesEnabled,
  getProviderStatus,
  watchProviderStatus,
  getLocationAvailability,
  getLocationReadiness,
  requestLocationSettings,
  requestLocationSettingsDetailed,
  getAccuracyAuthorization,
  requestTemporaryFullAccuracy,
  getCurrentPosition,
  getLastKnownPosition,
  getLastKnownPositionAsync,
  geocode,
  reverseGeocode,
  getHeading,
  watchHeading,
  watchPosition,
  getActiveWatches,
  unwatch,
  stopObserving
} from "./api";

// Background API
export * from "./background";

// Hooks
export * from "./hooks";

// Types from Nitro spec
export type {
  PermissionStatus,
  LocationRequestOptions,
  LocationSettingsOptions,
  LocationError
} from "./NitroGeolocation.nitro";

export type { CurrentPositionOptions } from "./api/currentPositionOptions";

export type {
  GeolocationResponse,
  GeolocationCoordinates,
  LocationProviderStatus,
  LocationSettingsOutcome,
  LocationSettingsResult,
  LocationAvailability,
  LocationReadiness,
  LocationCacheReadiness,
  LocationReadinessRemediation,
  PermissionDetails,
  PermissionScope,
  PermissionSettingsGuidance,
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
  ActiveWatch,
  ActiveWatchKind,
  AuthorizationLevel,
  LocationProvider,
  LocationProviderUsed,
  LocationMetadata,
  LocationQualityBand,
  LocationResponseSource,
  LocationStaleReason,
  GeolocationConfiguration
} from "./publicTypes";

// Pure utility functions (advanced users only)
export * from "./utils";
