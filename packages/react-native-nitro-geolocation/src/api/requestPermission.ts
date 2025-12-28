import type { PermissionStatus } from "../NitroGeolocation.nitro";
import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";

/**
 * Request location permission from the user.
 * Shows system permission dialog if not yet determined.
 *
 * @returns Promise resolving to new permission status
 * @example
 * ```tsx
 * import { requestPermission } from 'react-native-nitro-geolocation';
 *
 * const status = await requestPermission();
 * if (status === 'granted') {
 *   // Get location
 * }
 * ```
 */
export function requestPermission(): Promise<PermissionStatus> {
  return NitroGeolocationHybridObject.requestPermission();
}
