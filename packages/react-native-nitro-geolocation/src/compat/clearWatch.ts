import { NitroModules } from "react-native-nitro-modules";
import type { NitroGeolocationCompat } from "../NitroGeolocationCompat.nitro";

/**
 * Clears a specific watch session identified by watchId.
 *
 * @param watchId - The ID returned by watchPosition()
 */
export function clearWatch(watchId: number): void {
  const nitroGeolocation =
    NitroModules.createHybridObject<NitroGeolocationCompat>(
      "NitroGeolocationCompat"
    );
  nitroGeolocation.clearWatch(watchId);
}
