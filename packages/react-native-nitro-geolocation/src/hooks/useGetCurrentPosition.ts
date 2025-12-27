import { useCallback, useEffect, useRef, useState } from "react";
import type {
  LocationError,
  LocationRequestOptions
} from "../NitroGeolocation.nitro";
import { useGeolocationClient } from "../components/GeolocationProvider";
import type { GeolocationResponse } from "../types";

/**
 * Options for useGetCurrentPosition hook (Query style).
 */
export interface UseGetCurrentPositionOptions extends LocationRequestOptions {
  /**
   * Whether to automatically fetch the current position.
   * When false, only manual refetch() will trigger the request.
   * @default true
   */
  enabled?: boolean;
}

/**
 * Hook for getting current location (one-time request) in Query style.
 * Provides loading, error states, and data similar to TanStack Query.
 *
 * @param options - Location request options and enabled flag
 * @returns Object containing position, loading/error states, and refetch function
 *
 * @example
 * ```tsx
 * // Auto-fetch on mount
 * function MyComponent() {
 *   const {
 *     position,
 *     isLoading,
 *     isError,
 *     error,
 *     refetch
 *   } = useGetCurrentPosition({
 *     enabled: true,
 *     enableHighAccuracy: true,
 *   });
 *
 *   if (isLoading) return <Text>Loading...</Text>;
 *   if (isError) return <Text>Error: {error?.message}</Text>;
 *   if (!position) return null;
 *
 *   return (
 *     <View>
 *       <Text>Lat: {position.coords.latitude}</Text>
 *       <Text>Lng: {position.coords.longitude}</Text>
 *       <Button title="Refresh" onPress={() => refetch()} />
 *     </View>
 *   );
 * }
 *
 * // Manual trigger only
 * function ManualComponent() {
 *   const { position, isLoading, refetch } = useGetCurrentPosition({
 *     enabled: false
 *   });
 *
 *   return (
 *     <View>
 *       <Button
 *         title="Get Location"
 *         onPress={() => refetch()}
 *         disabled={isLoading}
 *       />
 *       {position && <Text>Lat: {position.coords.latitude}</Text>}
 *     </View>
 *   );
 * }
 * ```
 */
export function useGetCurrentPosition(options?: UseGetCurrentPositionOptions) {
  const client = useGeolocationClient();

  const [position, setPosition] = useState<GeolocationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<LocationError | null>(null);

  const isMountedRef = useRef(true);
  const optionsRef = useRef(options);

  // Update options ref when they change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const fetchPosition = useCallback(async () => {
    if (!isMountedRef.current) return;

    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      const result = await client.getCurrentPosition(optionsRef.current);
      if (!isMountedRef.current) return;

      setPosition(result);
      setIsLoading(false);
    } catch (err) {
      if (!isMountedRef.current) return;

      setIsError(true);
      setError(err as LocationError);
      setIsLoading(false);
    }
  }, [client]);

  // Extract enabled flag for reactive dependency
  const enabled = options?.enabled ?? true;

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (enabled) {
      fetchPosition();
    }
    // Only run when enabled changes, not when fetchPosition changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Track mount status
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    position,
    isLoading,
    isError,
    error,
    refetch: fetchPosition
  };
}
