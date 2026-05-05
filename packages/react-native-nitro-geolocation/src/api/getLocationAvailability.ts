import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
import type { LocationAvailability } from "../publicTypes";

/**
 * Check whether the current platform is likely to deliver location updates.
 *
 * @returns Promise resolving to availability state plus an optional reason.
 */
export function getLocationAvailability(): Promise<LocationAvailability> {
  return NitroGeolocationHybridObject.getLocationAvailability();
}
