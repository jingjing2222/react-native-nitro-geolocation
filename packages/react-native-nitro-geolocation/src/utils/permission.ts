import { NitroGeolocationHybridObject } from '../NitroGeolocationModule';
import type { PermissionStatus } from '../NitroGeolocation.nitro';
import type { GeolocationResponse } from '../types';
import type { LocationRequestOptions } from '../NitroGeolocation.nitro';

/**
 * Check current location permission status.
 * Does NOT request permission, only checks current state.
 *
 * @returns Promise resolving to current permission status
 *
 * @example
 * ```tsx
 * const status = await checkPermission();
 * if (status === 'granted') {
 *   // Can use location
 * }
 * ```
 */
export async function checkPermission(): Promise<PermissionStatus> {
  return await NitroGeolocationHybridObject.checkPermission();
}

/**
 * Request location permission from the user.
 * Shows system permission dialog if not yet determined.
 *
 * @returns Promise resolving to new permission status
 *
 * @example
 * ```tsx
 * async function handleRequestPermission() {
 *   try {
 *     const status = await requestPermission();
 *     if (status === 'granted') {
 *       console.log('Permission granted!');
 *     }
 *   } catch (error) {
 *     console.error('Permission error:', error);
 *   }
 * }
 * ```
 */
export async function requestPermission(): Promise<PermissionStatus> {
  return await NitroGeolocationHybridObject.requestPermission();
}

/**
 * Get current location (one-time request).
 * Throws error if permission denied, timeout, or unavailable.
 *
 * @param options - Location request options
 * @returns Promise resolving to current position
 * @throws LocationError with code and message
 *
 * @example
 * ```tsx
 * async function handleGetLocation() {
 *   try {
 *     const position = await getCurrentPosition({
 *       enableHighAccuracy: true,
 *       timeout: 15000,
 *     });
 *     console.log('Lat:', position.coords.latitude);
 *     console.log('Lng:', position.coords.longitude);
 *   } catch (error) {
 *     console.error('Location error:', error.message);
 *   }
 * }
 * ```
 */
export async function getCurrentPosition(
  options?: LocationRequestOptions
): Promise<GeolocationResponse> {
  return await NitroGeolocationHybridObject.getCurrentPosition(options);
}
