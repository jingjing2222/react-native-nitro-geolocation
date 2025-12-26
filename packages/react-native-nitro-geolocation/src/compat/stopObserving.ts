import { NitroModules } from "react-native-nitro-modules";
import type { NitroGeolocationCompat } from "../NitroGeolocationCompat.nitro";

/**
 * Stops observing all location updates.
 * This will clear all active watch sessions.
 */
export function stopObserving(): void {
  const nitroGeolocation =
    NitroModules.createHybridObject<NitroGeolocationCompat>("NitroGeolocationCompat");
  nitroGeolocation.stopObserving();
}
