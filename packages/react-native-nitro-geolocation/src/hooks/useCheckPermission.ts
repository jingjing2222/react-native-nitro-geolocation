import { useGeolocationContext } from '../components/GeolocationProvider';
import { NitroGeolocationHybridObject } from '../NitroGeolocationModule';
import type { PermissionStatus } from '../NitroGeolocation.nitro';

/**
 * Hook that returns a function to check current location permission status.
 * Does NOT request permission, only checks current state.
 *
 * @returns Function that returns Promise resolving to current permission status
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const checkPermission = useCheckPermission();
 *
 *   const handleCheck = async () => {
 *     const status = await checkPermission();
 *     if (status === 'granted') {
 *       // Can use location
 *     }
 *   };
 *
 *   return <Button onPress={handleCheck} />;
 * }
 * ```
 */
export function useCheckPermission() {
  // Ensure this hook is used within GeolocationProvider
  useGeolocationContext();

  return (): Promise<PermissionStatus> => {
    return NitroGeolocationHybridObject.checkPermission();
  };
}
