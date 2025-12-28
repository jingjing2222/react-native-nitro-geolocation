import type { PermissionStatus } from "../NitroGeolocation.nitro";
import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";

/**
 * Check current location permission status.
 * Does NOT request permission, only checks current state.
 *
 * @returns Promise resolving to current permission status
 * @example
 * ```tsx
 * import { checkPermission } from 'react-native-nitro-geolocation';
 *
 * const status = await checkPermission();
 * if (status === 'granted') {
 *   // Get location
 * }
 * ```
 */
export function checkPermission(): Promise<PermissionStatus> {
  return NitroGeolocationHybridObject.checkPermission();
}
