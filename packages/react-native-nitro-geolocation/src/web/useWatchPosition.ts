import { useEffect, useRef, useState } from "react";
import type {
  LocationError,
  LocationRequestOptions
} from "../NitroGeolocation.nitro";
import type { GeolocationResponse } from "../publicTypes";
import { unwatch, watchPosition } from "./watch";

export interface UseWatchPositionOptions extends LocationRequestOptions {
  enabled?: boolean;
}

export function useWatchPosition(options?: UseWatchPositionOptions) {
  const [position, setPosition] = useState<GeolocationResponse | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [error, setError] = useState<LocationError | null>(null);
  const tokenRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
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
      if (tokenRef.current) {
        unwatch(tokenRef.current);
        tokenRef.current = null;
      }
      setIsWatching(false);
      return;
    }

    setIsWatching(true);
    setError(null);
    const token = watchPosition(
      (nextPosition) => {
        if (!isMountedRef.current) {
          return;
        }
        setPosition(nextPosition);
        setError(null);
      },
      (nextError) => {
        if (!isMountedRef.current) {
          return;
        }
        setError(nextError);
      },
      optionsRef.current
    );
    tokenRef.current = token;

    return () => {
      unwatch(token);
      if (tokenRef.current === token) {
        tokenRef.current = null;
      }
    };
  }, [enabled]);

  return {
    position,
    error,
    isWatching
  };
}
