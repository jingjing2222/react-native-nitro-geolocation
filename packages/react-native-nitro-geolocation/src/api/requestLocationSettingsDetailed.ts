import type { LocationSettingsOptions } from "../NitroGeolocation.nitro";
import type { LocationSettingsResult } from "../publicTypes";
import { requestLocationSettings } from "./requestLocationSettings";

/**
 * Returns the detailed, deterministic location-settings outcome.
 *
 * This explicit name is an alias for `requestLocationSettings()` in v2, where
 * the original method already returns `LocationSettingsResult`.
 */
export function requestLocationSettingsDetailed(
  options?: LocationSettingsOptions
): Promise<LocationSettingsResult> {
  return requestLocationSettings(options);
}
