import type { PermissionStatus } from "../NitroGeolocation.nitro";
import { useGeolocationClient } from "../components/GeolocationProvider";

/**
 * Hook that returns a function to check current location permission status.
 * Does NOT request permission, only checks current state.
 *
 * Must be used within GeolocationClientProvider.
 *
 * @returns Object containing checkPermission function
 *
 * @example
 * ```tsx
 * const geolocationClient = new GeolocationClient({...config});
 *
 * function App() {
 *   return (
 *     <GeolocationClientProvider client={geolocationClient}>
 *       <MyComponent />
 *     </GeolocationClientProvider>
 *   );
 * }
 *
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
  const client = useGeolocationClient();

  return {
    checkPermission: (): Promise<PermissionStatus> => {
      return client.checkPermission();
    }
  };
}
