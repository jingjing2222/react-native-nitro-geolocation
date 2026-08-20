import type { LocationSettingsOptions } from "../NitroGeolocation.nitro";
import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
import type { LocationSettingsResult } from "../publicTypes";

/**
 * Android-only settings resolution API.
 *
 * Android: checks whether current device settings satisfy the requested
 * location requirements and shows Android's native settings resolution dialog
 * when available.
 *
 * Expected settings outcomes resolve with `outcome` and the latest
 * `providerStatus`. Only request failures such as a concurrent request reject.
 *
 * iOS: does not show a settings dialog and ignores `options`. It reports
 * `satisfied` when Core Location services are enabled, otherwise `unavailable`.
 */
export function requestLocationSettings(
  options?: LocationSettingsOptions
): Promise<LocationSettingsResult> {
  return new Promise((resolve, reject) => {
    NitroGeolocationHybridObject.requestLocationSettings(
      resolve,
      options ?? {},
      reject
    );
  });
}
