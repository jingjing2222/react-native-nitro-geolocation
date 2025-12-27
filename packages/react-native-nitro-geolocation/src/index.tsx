/**
 * Modern Geolocation API for React Native.
 *
 * This is the main entry point for the modern, React-friendly API.
 * For legacy compatibility, use: import Geolocation from 'react-native-nitro-geolocation/compat'
 *
 * @example
 * ```tsx
 * import {
 *   GeolocationProvider,
 *   useLocationPermission,
 *   useCurrentPosition,
 *   useWatchPosition
 * } from 'react-native-nitro-geolocation';
 *
 * function App() {
 *   return (
 *     <GeolocationProvider
 *       config={{
 *         authorizationLevel: 'whenInUse',
 *         enableBackgroundLocationUpdates: false,
 *         locationProvider: 'auto'
 *       }}
 *     >
 *       <YourApp />
 *     </GeolocationProvider>
 *   );
 * }
 *
 * function YourComponent() {
 *   const { data, error } = useCurrentPosition({
 *     enableHighAccuracy: true
 *   });
 *
 *   if (error) return <Text>Error: {error.message}</Text>;
 *   if (!data) return <Text>Loading...</Text>;
 *
 *   return <Text>Lat: {data.coords.latitude}</Text>;
 * }
 * ```
 */

// Components
export * from './components';

// Hooks
export * from './hooks';

// Types from Nitro spec
export type {
  PermissionStatus,
  AuthorizationLevel,
  LocationProvider,
  ModernGeolocationConfiguration,
  LocationRequestOptions,
  LocationError,
} from './NitroGeolocation.nitro';

export type {
  GeolocationResponse,
  GeolocationCoordinates,
} from './types';

// Pure utility functions (advanced users only)
export * from './utils';
