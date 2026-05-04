import type { LocationSettingsOptions } from "../NitroGeolocation.nitro";
import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
import type { LocationProviderStatus } from "../publicTypes";

/**
 * Android: request native location settings that satisfy the provided
 * requirements, showing Android's system resolution dialog when available.
 *
 * iOS resolves with the current provider status without showing a settings
 * dialog.
 */
export function requestLocationSettings(
  options?: LocationSettingsOptions
): Promise<LocationProviderStatus> {
  return new Promise((resolve, reject) => {
    NitroGeolocationHybridObject.requestLocationSettings(
      resolve,
      reject,
      options
    );
  });
}
