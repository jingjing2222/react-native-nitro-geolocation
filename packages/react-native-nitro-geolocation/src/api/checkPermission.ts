import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
import type { PermissionStatus } from "../publicTypes";

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
