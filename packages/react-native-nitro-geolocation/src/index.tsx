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
 *   useRequestPermission,
 *   useGetCurrentPosition,
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

// Components
export * from "./components";

// Hooks
export * from "./hooks";

// Types from Nitro spec
export type {
  PermissionStatus,
  AuthorizationLevel,
  LocationProvider,
  ModernGeolocationConfiguration,
  LocationRequestOptions,
  LocationError
} from "./NitroGeolocation.nitro";

export type {
  GeolocationResponse,
  GeolocationCoordinates
} from "./types";

// Pure utility functions (advanced users only)
export * from "./utils";
