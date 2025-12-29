import type { LocationRequestOptions } from "../NitroGeolocation.nitro";
import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
import { isDevtoolsEnabled } from "../devtools";
import { getDevtoolsCurrentPosition } from "../devtools/getCurrentPosition";
import type { GeolocationResponse } from "../types";

/**
 * Get current location (one-time request).
 *
 * Strategy:
 * 1. Check cached location (if maximumAge allows)
 * 2. Request fresh location from GPS/Network
 * 3. Timeout after specified duration
 *
 * @param options - Location request options
 * @returns Promise resolving to current position
 * @throws LocationError if permission denied, timeout, or unavailable
 * @example
 * ```tsx
 * import { getCurrentPosition } from 'react-native-nitro-geolocation';
 *
 * try {
 *   const position = await getCurrentPosition({
 *     enableHighAccuracy: true,
 *     timeout: 15000
 *   });
 *   console.log(position.coords.latitude, position.coords.longitude);
 * } catch (error) {
 *   console.error(error.message);
 * }
 * ```
 */
export function getCurrentPosition(
  options?: LocationRequestOptions
): Promise<GeolocationResponse> {
  if (isDevtoolsEnabled()) {
    const devtoolsResult = getDevtoolsCurrentPosition();
    if (devtoolsResult) {
      return devtoolsResult;
    }
  }
  return NitroGeolocationHybridObject.getCurrentPosition(options);
}
