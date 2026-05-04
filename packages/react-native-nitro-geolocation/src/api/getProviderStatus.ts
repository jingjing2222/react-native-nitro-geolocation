import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
import type { LocationProviderStatus } from "../publicTypes";

/**
 * Get native provider/settings status for the current device.
 *
 * Android: returns device-level service state plus provider availability
 * (`gpsAvailable`, `networkAvailable`, `passiveAvailable`) and Google Location
 * Accuracy state when Google Play Services exposes it.
 *
 * iOS: returns Core Location service availability and whether the app declares
 * background location mode. Android-specific provider fields are `undefined`.
 */
export function getProviderStatus(): Promise<LocationProviderStatus> {
  return NitroGeolocationHybridObject.getProviderStatus();
}
