import type { PermissionStatus } from "../NitroGeolocation.nitro";
import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
import { useGeolocationContext } from "../components/GeolocationProvider";

/**
 * Hook that returns a function to request location permission from the user.
 * Shows system permission dialog if not yet determined.
 *
 * @returns Object containing requestPermission function
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { requestPermission } = useRequestPermission();
 *
 *   const handleRequest = async () => {
 *     try {
 *       const status = await requestPermission();
 *       if (status === 'granted') {
 *         console.log('Permission granted!');
 *       }
 *     } catch (error) {
 *       console.error('Permission error:', error);
 *     }
 *   };
 *
 *   return <Button onPress={handleRequest} />;
 * }
 * ```
 */
export function useRequestPermission() {
  // Ensure this hook is used within GeolocationProvider
  useGeolocationContext();

  return {
    requestPermission: (): Promise<PermissionStatus> => {
      return NitroGeolocationHybridObject.requestPermission();
    }
  };
}
