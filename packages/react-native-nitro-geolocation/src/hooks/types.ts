import type {
  LocationError,
  LocationRequestOptions
} from "../NitroGeolocation.nitro";
import type { GeolocationResponse } from "../publicTypes";

/** Options for the declarative position watcher. */
export interface UseWatchPositionOptions extends LocationRequestOptions {
  /**
   * Whether to actively watch for location updates.
   * When false, watching is paused and cleanup is performed.
   * @default false
   */
  enabled?: boolean;
}

/** State returned by `useWatchPosition()`. */
export interface UseWatchPositionResult {
  position: GeolocationResponse | null;
  error: LocationError | null;
  isWatching: boolean;
}
