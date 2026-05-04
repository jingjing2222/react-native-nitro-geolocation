import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
import type { LocationProviderStatus } from "../publicTypes";

/**
 * Get native provider/settings status for the current device.
 */
export function getProviderStatus(): Promise<LocationProviderStatus> {
  return NitroGeolocationHybridObject.getProviderStatus();
}
