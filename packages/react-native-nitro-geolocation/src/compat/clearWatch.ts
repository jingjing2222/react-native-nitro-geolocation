import { NitroGeolocationHybridCompatObject } from "../NitroGeolocationModule";
/**
 * Clears a specific watch session identified by watchId.
 *
 * @param watchId - The ID returned by watchPosition()
 */
export function clearWatch(watchId: number): void {
  NitroGeolocationHybridCompatObject.clearWatch(watchId);
}
