/**
 * Modern Geolocation API for React Native.
 *
 * This is the main entry point for the modern, React-friendly API.
 * For legacy compatibility, use: import Geolocation from 'react-native-nitro-geolocation/compat'
 *
 * @example
 * ```tsx
 * import {
 *   GeolocationClient,
 *   GeolocationClientProvider,
 *   useRequestPermission,
 *   useGetCurrentPosition,
 *   useWatchPosition
 * } from 'react-native-nitro-geolocation';
 *
 * // Create GeolocationClient instance
 * const geolocationClient = new GeolocationClient({
 *   authorizationLevel: 'whenInUse',
 *   enableBackgroundLocationUpdates: false,
 *   locationProvider: 'auto'
 * });
 *
 * function App() {
 *   return (
 *     <GeolocationClientProvider client={geolocationClient}>
 *       <YourApp />
 *     </GeolocationClientProvider>
 *   );
 * }
 *
 * function LocationButton() {
 *   const { getCurrentPosition } = useGetCurrentPosition();
 *   const [loading, setLoading] = useState(false);
 *
 *   const handlePress = async () => {
 *     setLoading(true);
 *     try {
 *       const pos = await getCurrentPosition({ enableHighAccuracy: true });
 *       console.log('Position:', pos);
 *     } catch (error) {
 *       console.error('Error:', error);
 *     } finally {
 *       setLoading(false);
 *     }
 *   };
 *
 *   return <Button onPress={handlePress} disabled={loading} />;
 * }
 * ```
 */

// Core
export { GeolocationClient } from "./GeolocationClient";
export type { GeolocationClientConfig } from "./GeolocationClient";

// Components
export * from "./components";

// Hooks
export * from "./hooks";

// Types from Nitro spec
export type {
  PermissionStatus,
  LocationRequestOptions,
  LocationError
} from "./NitroGeolocation.nitro";

export type {
  GeolocationResponse,
  GeolocationCoordinates,
  AuthorizationLevel,
  LocationProvider,
  ModernGeolocationConfiguration
} from "./types";

// Pure utility functions (advanced users only)
export * from "./utils";
