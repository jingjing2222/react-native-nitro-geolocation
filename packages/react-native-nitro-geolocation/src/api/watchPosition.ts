import type {
  LocationError,
  LocationRequestOptions
} from "../NitroGeolocation.nitro";
import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
import { isDevtoolsEnabled } from "../devtools";
import { devtoolsWatchPosition } from "../devtools/watchPosition";
import type { GeolocationResponse } from "../types";

/**
 * Start watching for continuous location updates.
 *
 * IMPORTANT: This is a LOW-LEVEL API.
 * For React components, use useWatchPosition() hook instead.
 *
 * @param success - Called on each successful location update
 * @param error - Called when an error occurs
 * @param options - Location request options
 * @returns Subscription token (UUID string) for cleanup
 * @example
 * ```tsx
 * import { watchPosition, unwatch } from 'react-native-nitro-geolocation';
 *
 * const token = watchPosition(
 *   (position) => console.log(position.coords),
 *   (error) => console.error(error.message),
 *   { enableHighAccuracy: true, distanceFilter: 10 }
 * );
 *
 * // Later: cleanup
 * unwatch(token);
 * ```
 */
export function watchPosition(
  success: (position: GeolocationResponse) => void,
  error?: (error: LocationError) => void,
  options?: LocationRequestOptions
): string {
  if (isDevtoolsEnabled()) {
    return devtoolsWatchPosition(success, error);
  }
  return NitroGeolocationHybridObject.watchPosition(success, error, options);
}
