import { useState, useEffect, useCallback, useRef } from 'react';
import { NitroGeolocationHybridObject } from '../NitroGeolocationModule';
import { useGeolocationContext } from '../components/GeolocationProvider';
import type { GeolocationResponse } from '../types';
import type { LocationRequestOptions } from '../NitroGeolocation.nitro';
import type { LocationError } from '../utils/errors';

/**
 * Status of the current position request.
 */
export type CurrentPositionStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * Options for useCurrentPosition hook.
 */
export interface UseCurrentPositionOptions extends LocationRequestOptions {
  /**
   * Whether to automatically fetch position on mount.
   * @default true
   */
  enabled?: boolean;
}

/**
 * Hook for fetching current location (one-time).
 * Similar to React Query's useQuery pattern.
 *
 * @param options - Location request options
 * @returns Object containing data, status, error, and refetch function
 *
 * @example
 * ```tsx
 * function LocationDisplay() {
 *   const { data, status, error, refetch } = useCurrentPosition({
 *     enableHighAccuracy: true,
 *     enabled: true
 *   });
 *
 *   if (status === 'loading') return <Text>Loading...</Text>;
 *   if (error) return <Text>Error: {error.message}</Text>;
 *   if (!data) return null;
 *
 *   return (
 *     <View>
 *       <Text>Lat: {data.coords.latitude}</Text>
 *       <Text>Lng: {data.coords.longitude}</Text>
 *       <Button title="Refresh" onPress={refetch} />
 *     </View>
 *   );
 * }
 * ```
 */
export function useCurrentPosition(options?: UseCurrentPositionOptions) {
  // Ensure this hook is used within GeolocationProvider
  useGeolocationContext();

  const [data, setData] = useState<GeolocationResponse | null>(null);
  const [status, setStatus] = useState<CurrentPositionStatus>('idle');
  const [error, setError] = useState<LocationError | null>(null);

  const optionsRef = useRef(options);
  const enabledRef = useRef(options?.enabled ?? true);

  // Update refs
  optionsRef.current = options;
  enabledRef.current = options?.enabled ?? true;

  const fetchPosition = useCallback(async () => {
    setStatus('loading');
    setError(null);

    try {
      const position = await NitroGeolocationHybridObject.getCurrentPosition(
        optionsRef.current
      );
      setData(position);
      setStatus('success');
    } catch (err) {
      const locationError = err as LocationError;
      setError(locationError);
      setStatus('error');
    }
  }, []);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (enabledRef.current) {
      fetchPosition();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    data,
    status,
    error,
    refetch: fetchPosition,
  };
}
