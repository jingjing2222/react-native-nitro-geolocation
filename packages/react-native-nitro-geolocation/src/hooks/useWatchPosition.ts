import { useState, useEffect, useRef } from 'react';
import { NitroGeolocationHybridObject } from '../NitroGeolocationModule';
import { useGeolocationContext } from '../components/GeolocationProvider';
import type { GeolocationResponse } from '../types';
import type {
  LocationRequestOptions,
  LocationError,
} from '../NitroGeolocation.nitro';

/**
 * Options for useWatchPosition hook.
 */
export interface UseWatchPositionOptions extends LocationRequestOptions {
  /**
   * Whether to actively watch for location updates.
   * When false, watching is paused and cleanup is performed.
   * @default false
   */
  enabled?: boolean;
}

/**
 * Hook for continuous location tracking.
 * Automatically subscribes/unsubscribes based on component lifecycle.
 *
 * The subscription token is completely hidden from the user.
 * Cleanup is automatic via useEffect.
 *
 * @param options - Location request options
 * @returns Object containing current position data, error, and watching status
 *
 * @example
 * ```tsx
 * function LiveTracking() {
 *   const { data, error, isWatching } = useWatchPosition({
 *     enabled: true,
 *     enableHighAccuracy: true,
 *     distanceFilter: 10  // Update every 10 meters
 *   });
 *
 *   if (!isWatching) return <Text>Not watching</Text>;
 *   if (error) return <Text>Error: {error.message}</Text>;
 *   if (!data) return <Text>Waiting for location...</Text>;
 *
 *   return (
 *     <Text>
 *       Current: {data.coords.latitude}, {data.coords.longitude}
 *       Accuracy: {data.coords.accuracy}m
 *     </Text>
 *   );
 * }
 * ```
 */
export function useWatchPosition(options?: UseWatchPositionOptions) {
  // Ensure this hook is used within GeolocationProvider
  useGeolocationContext();

  const [data, setData] = useState<GeolocationResponse | null>(null);
  const [error, setError] = useState<LocationError | null>(null);
  const [isWatching, setIsWatching] = useState(false);

  // Store subscription token (hidden from user!)
  const tokenRef = useRef<string | null>(null);

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  useEffect(() => {
    const enabled = options?.enabled ?? false;

    if (!enabled) {
      // Not enabled, ensure cleanup
      if (tokenRef.current) {
        NitroGeolocationHybridObject.unwatch(tokenRef.current);
        tokenRef.current = null;
      }
      setIsWatching(false);
      return;
    }

    // Start watching
    setIsWatching(true);

    const token = NitroGeolocationHybridObject.watchPosition(
      (position: GeolocationResponse) => {
        // Success callback
        if (!isMountedRef.current) return;
        setData(position);
        setError(null);
      },
      (err: LocationError) => {
        // Error callback
        if (!isMountedRef.current) return;
        setError(err);
      },
      options
    );

    tokenRef.current = token;

    // Cleanup function
    return () => {
      if (token) {
        NitroGeolocationHybridObject.unwatch(token);
      }
    };
  }, [
    options?.enabled,
    options?.enableHighAccuracy,
    options?.distanceFilter,
    options?.interval,
    options?.fastestInterval,
    options?.timeout,
    options?.maximumAge,
    options?.useSignificantChanges,
  ]);

  // Track mount status
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    data,
    error,
    isWatching,
  };
}
