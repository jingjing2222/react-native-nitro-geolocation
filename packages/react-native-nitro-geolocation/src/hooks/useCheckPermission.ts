import type { PermissionStatus } from "../NitroGeolocation.nitro";
import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
import { useGeolocationContext } from "../components/GeolocationProvider";

/**
 * Hook that returns a function to check current location permission status.
 * Does NOT request permission, only checks current state.
 *
 * @returns Object containing checkPermission function
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { checkPermission } = useCheckPermission();
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

  return {
    checkPermission: (): Promise<PermissionStatus> => {
      return NitroGeolocationHybridObject.checkPermission();
    }
  };
}
