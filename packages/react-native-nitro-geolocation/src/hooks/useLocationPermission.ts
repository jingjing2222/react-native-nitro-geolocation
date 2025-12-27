import { useState, useCallback } from 'react';
import { NitroGeolocationHybridObject } from '../NitroGeolocationModule';
import { useGeolocationContext } from '../components/GeolocationProvider';
import type { PermissionStatus } from '../NitroGeolocation.nitro';
import type { LocationError } from '../utils/errors';

/**
 * Hook for managing location permission.
 *
 * @returns Object containing permission status, request function, loading state, and error
 *
 * @example
 * ```tsx
 * function PermissionScreen() {
 *   const { status, request, isLoading, error } = useLocationPermission();
 *
 *   if (status === 'granted') {
 *     return <Text>Permission granted!</Text>;
 *   }
 *
 *   return (
 *     <Button
 *       onPress={request}
 *       disabled={isLoading}
 *       title="Request Permission"
 *     />
 *   );
 * }
 * ```
 */
export function useLocationPermission() {
  // Ensure this hook is used within GeolocationProvider
  useGeolocationContext();

  const [status, setStatus] = useState<PermissionStatus>('undetermined');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<LocationError | null>(null);

  const request = useCallback(async (): Promise<PermissionStatus> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await NitroGeolocationHybridObject.requestPermission();
      setStatus(result);
      setIsLoading(false);
      return result;
    } catch (err) {
      const locationError = err as LocationError;
      setError(locationError);
      setIsLoading(false);
      throw err;
    }
  }, []);

  return {
    status,
    request,
    isLoading,
    error,
  };
}
