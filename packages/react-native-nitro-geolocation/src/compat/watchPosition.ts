import { NitroGeolocationHybridCompatObject } from "../NitroGeolocationModule";
import type {
  CompatGeolocationResponse,
  GeolocationError,
  GeolocationOptions
} from "../publicTypes";

/**
 * Invokes the success callback whenever the location changes.
 * Returns a watchId (number) that can be used with clearWatch().
 *
 * @param success - Called whenever the location changes
 * @param error - Called if an error occurs
 * @param options - Configuration options for watching position
 * @returns watchId - A number that identifies this watch session
 */
export function watchPosition(
  success: (position: CompatGeolocationResponse) => void,
  error?: (error: GeolocationError) => void,
  options?: GeolocationOptions
): number {
  return NitroGeolocationHybridCompatObject.watchPosition(
    success,
    error,
    options
  );
}
