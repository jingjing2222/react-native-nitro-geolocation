import { useEffect, useRef, useState } from "react";
import type {
  UseWatchPositionOptions,
  UseWatchPositionResult
} from "../hooks/types";
import type { GeolocationResponse } from "../publicTypes";
import type { LocationError } from "../utils/errors";
import { unwatch, watchPosition } from "./watch";

export function useWatchPosition(
  options?: UseWatchPositionOptions
): UseWatchPositionResult {
  const [position, setPosition] = useState<GeolocationResponse | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [error, setError] = useState<LocationError | null>(null);
  const isMountedRef = useRef(true);
  const hasErrorRef = useRef(false);
  const optionsRef = useRef(options);
  const enabled = options?.enabled ?? false;

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIsWatching(false);
      return;
    }

    setIsWatching(true);
    hasErrorRef.current = false;
    setError(null);
    const token = watchPosition(
      (nextPosition) => {
        if (!isMountedRef.current) {
          return;
        }
        setPosition(nextPosition);
        if (hasErrorRef.current) {
          hasErrorRef.current = false;
          setError(null);
        }
      },
      (nextError) => {
        if (!isMountedRef.current) {
          return;
        }
        hasErrorRef.current = true;
        setError(nextError);
      },
      optionsRef.current
    );
    return () => {
      unwatch(token);
    };
  }, [enabled]);

  return {
    position,
    error,
    isWatching
  };
}
