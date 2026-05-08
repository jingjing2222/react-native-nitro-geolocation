import { NitroGeolocationHybridCompatObject } from "../NitroGeolocationModule";
import type {
  CompatGeolocationError,
  CompatGeolocationOptions,
  CompatGeolocationResponse
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
  error?: (error: CompatGeolocationError) => void,
  options?: CompatGeolocationOptions
): number {
  return NitroGeolocationHybridCompatObject.watchPosition(
    success,
    options ?? {},
    error
  );
}
