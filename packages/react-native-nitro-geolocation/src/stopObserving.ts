import { NitroModules } from "react-native-nitro-modules";
import type { NitroGeolocation } from "./NitroGeolocation.nitro";

/**
 * Stops observing all location updates.
 * This will clear all active watch sessions.
 */
export function stopObserving(): void {
  const nitroGeolocation =
    NitroModules.createHybridObject<NitroGeolocation>("NitroGeolocation");
  nitroGeolocation.stopObserving();
}
