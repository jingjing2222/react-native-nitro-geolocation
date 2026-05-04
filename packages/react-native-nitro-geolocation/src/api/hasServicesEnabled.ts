import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";

/**
 * Check whether device-level location services are enabled.
 *
 * Android: checks the system location service/provider state used by native
 * Android location requests.
 *
 * iOS: maps to `CLLocationManager.locationServicesEnabled()`.
 */
export function hasServicesEnabled(): Promise<boolean> {
  return NitroGeolocationHybridObject.hasServicesEnabled();
}
