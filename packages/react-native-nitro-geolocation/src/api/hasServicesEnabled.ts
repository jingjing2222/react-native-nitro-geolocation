import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";

/**
 * Check whether device-level location services are enabled.
 *
 * On Android this checks the system location service/provider state. On iOS it
 * maps to Core Location services availability.
 */
export function hasServicesEnabled(): Promise<boolean> {
  return NitroGeolocationHybridObject.hasServicesEnabled();
}
