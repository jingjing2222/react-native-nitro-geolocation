import type { LocationSettingsOptions } from "../NitroGeolocation.nitro";
import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
import type { LocationProviderStatus } from "../publicTypes";

/**
 * Android-only settings resolution API.
 *
 * Android: checks whether current device settings satisfy the requested
 * location requirements and shows Android's native settings resolution dialog
 * when available.
 *
 * iOS: does not show a settings dialog and ignores `options`. It resolves with
 * the current Core Location status:
 * - `locationServicesEnabled`: `CLLocationManager.locationServicesEnabled()`
 * - `backgroundModeEnabled`: whether `UIBackgroundModes` contains `location`
 * - `gpsAvailable`, `networkAvailable`, `passiveAvailable`, and
 *   `googleLocationAccuracyEnabled`: `undefined`
 */
export function requestLocationSettings(
  options?: LocationSettingsOptions
): Promise<LocationProviderStatus> {
  return new Promise((resolve, reject) => {
    NitroGeolocationHybridObject.requestLocationSettings(
      resolve,
      options ?? {},
      reject
    );
  });
}
