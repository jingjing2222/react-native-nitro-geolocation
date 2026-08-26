import { useEffect, useRef, useState } from "react";
import { unwatch, watchPosition } from "../api";
import type { GeolocationResponse } from "../publicTypes";
import type { LocationError } from "../utils/errors";
import type { UseWatchPositionOptions, UseWatchPositionResult } from "./types";

/**
 * Hook for continuous location tracking.
 * Automatically subscribes/unsubscribes based on component lifecycle.
 *
 * The subscription token is completely hidden from the user.
 * Cleanup is automatic via useEffect.
 *
 * @param options - Location request options
 * @returns Object containing current position, error, and watching status
 *
 * @example
 * ```tsx
 * function LiveTracking() {
 *   const { position, error, isWatching } = useWatchPosition({
 *     enabled: true,
 *     accuracy: { android: "high", ios: "best" },
 *     distanceFilter: 10  // Update every 10 meters
 *   });
 *
 *   if (!isWatching) return <Text>Not watching</Text>;
 *   if (error) return <Text>Error: {error.message}</Text>;
 *   if (!position) return <Text>Waiting for location...</Text>;
 *
 *   return (
 *     <Text>
 *       Current: {position.coords.latitude}, {position.coords.longitude}
 *       Accuracy: {position.coords.accuracy}m
 *     </Text>
 *   );
 * }
 * ```
 */
export function useWatchPosition(
  options?: UseWatchPositionOptions
): UseWatchPositionResult {
  const [position, setPosition] = useState<GeolocationResponse | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [error, setError] = useState<LocationError | null>(null);

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  const hasErrorRef = useRef(false);

  // Store latest options in ref to avoid unnecessary re-subscriptions
  const optionsRef = useRef(options);

  // Update options ref whenever options change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Extract enabled flag for reactive dependency
  const enabled = options?.enabled ?? false;

  useEffect(() => {
    if (!enabled) {
      setIsWatching(false);
      return;
    }

    // Start watching with latest options
    setIsWatching(true);
    hasErrorRef.current = false;
    setError(null);

    const token = watchPosition(
      (result: GeolocationResponse) => {
        // Success callback
        if (!isMountedRef.current) return;
        setPosition(result);
        if (hasErrorRef.current) {
          hasErrorRef.current = false;
          setError(null);
        }
      },
      (err: LocationError) => {
        // Error callback
        if (!isMountedRef.current) return;
        hasErrorRef.current = true;
        setError(err);
      },
      optionsRef.current
    );

    // Cleanup function
    return () => {
      unwatch(token);
    };
  }, [enabled]); // Only re-subscribe when enabled changes

  // Track mount status
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    position,
    error,
    isWatching
  };
}
