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
  const hasErrorRef = useRef(false);
  const optionsRef = useRef(options);
  const enabled = options?.enabled ?? false;

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (!enabled) {
      setIsWatching(false);
      return;
    }

    setIsWatching(true);
    hasErrorRef.current = false;
    setError(null);
    let active = true;
    const token = watchPosition(
      (nextPosition) => {
        if (!active) {
          return;
        }
        setPosition(nextPosition);
        if (hasErrorRef.current) {
          hasErrorRef.current = false;
          setError(null);
        }
      },
      (nextError) => {
        if (!active) {
          return;
        }
        hasErrorRef.current = true;
        setError(nextError);
      },
      optionsRef.current
    );
    return () => {
      active = false;
      unwatch(token);
    };
  }, [enabled]);

  return {
    position,
    error,
    isWatching
  };
}
