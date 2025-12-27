import { useGeolocationContext } from '../components/GeolocationProvider';
import { NitroGeolocationHybridObject } from '../NitroGeolocationModule';
import type { LocationRequestOptions } from '../NitroGeolocation.nitro';
import type { GeolocationResponse } from '../types';

/**
 * Hook that returns a function to get current location (one-time request).
 * The returned function throws error if permission denied, timeout, or unavailable.
 *
 * @returns Function that accepts options and returns Promise resolving to current position
 * @throws LocationError with code and message
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const getCurrentPosition = useGetCurrentPosition();
 *
 *   const handleGetLocation = async () => {
 *     try {
 *       const position = await getCurrentPosition({
 *         enableHighAccuracy: true,
 *         timeout: 15000,
 *       });
 *       console.log('Lat:', position.coords.latitude);
 *       console.log('Lng:', position.coords.longitude);
 *     } catch (error) {
 *       console.error('Location error:', error.message);
 *     }
 *   };
 *
 *   return <Button onPress={handleGetLocation} />;
 * }
 * ```
 */
export function useGetCurrentPosition() {
  // Ensure this hook is used within GeolocationProvider
  useGeolocationContext();

  return (options?: LocationRequestOptions): Promise<GeolocationResponse> => {
    return NitroGeolocationHybridObject.getCurrentPosition(options);
  };
}
