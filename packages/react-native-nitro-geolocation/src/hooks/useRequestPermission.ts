import { useCallback, useEffect, useRef, useState } from "react";
import type {
  LocationError,
  PermissionStatus
} from "../NitroGeolocation.nitro";
import { useGeolocationClient } from "../components/GeolocationProvider";

/**
 * Hook for requesting location permission in Mutation style.
 * Provides pending, error states, and status similar to TanStack Query mutations.
 *
 * @returns Object containing requestPermission function, status, and state flags
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const {
 *     requestPermission,
 *     status,
 *     isPending,
 *     isError,
 *     error
 *   } = useRequestPermission();
 *
 *   const handleRequest = async () => {
 *     const result = await requestPermission();
 *     if (result === 'granted') {
 *       console.log('Permission granted!');
 *     }
 *   };
 *
 *   return (
 *     <View>
 *       <Button
 *         onPress={handleRequest}
 *         disabled={isPending}
 *       >
 *         {isPending ? 'Requesting...' : 'Request Permission'}
 *       </Button>
 *       {isError && <Text>Error: {error?.message}</Text>}
 *       {status && <Text>Status: {status}</Text>}
 *     </View>
 *   );
 * }
 * ```
 */
export function useRequestPermission() {
  const client = useGeolocationClient();

  const [status, setStatus] = useState<PermissionStatus | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<LocationError | null>(null);

  const isMountedRef = useRef(true);

  const requestPermission = useCallback(async (): Promise<PermissionStatus> => {
    if (!isMountedRef.current) {
      throw new Error("Component unmounted");
    }

    setIsPending(true);
    setIsError(false);
    setError(null);

    try {
      const result = await client.requestPermission();
      if (!isMountedRef.current) return result;

      setStatus(result);
      setIsPending(false);
      return result;
    } catch (err) {
      if (!isMountedRef.current) throw err;

      setIsError(true);
      setError(err as LocationError);
      setIsPending(false);
      throw err;
    }
  }, [client]);

  // Track mount status
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    requestPermission,
    status,
    isPending,
    isError,
    error
  };
}
