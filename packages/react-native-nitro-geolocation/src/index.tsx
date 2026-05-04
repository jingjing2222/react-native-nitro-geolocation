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
 *     const position = await getCurrentPosition({ enableHighAccuracy: true });
 *     console.log('Position:', position);
 *   }
 * }
 *
 * // Continuous tracking in React component
 * function LiveTracking() {
 *   const { position, error, isWatching } = useWatchPosition({
 *     enabled: true,
 *     enableHighAccuracy: true,
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
  requestPermission,
  hasServicesEnabled,
  getProviderStatus,
  requestLocationSettings,
  getCurrentPosition,
  watchPosition,
  unwatch,
  stopObserving
} from "./api";

// Hooks
export * from "./hooks";

// Types from Nitro spec
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
  AuthorizationLevel,
  LocationProvider,
  LocationProviderUsed,
  GeolocationConfiguration,
  ModernGeolocationConfiguration
} from "./publicTypes";

// Pure utility functions (advanced users only)
export * from "./utils";
