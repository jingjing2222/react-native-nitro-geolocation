import type { LocationError } from "../NitroGeolocation.nitro";
import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
import type { AccuracyAuthorization } from "../publicTypes";

/**
 * Request temporary full location accuracy on iOS.
 *
 * Android resolves with the current accuracy authorization without showing a
 * prompt.
 */
export function requestTemporaryFullAccuracy(
  purposeKey: string
): Promise<AccuracyAuthorization> {
  return new Promise((resolve, reject: (error: LocationError) => void) => {
    NitroGeolocationHybridObject.requestTemporaryFullAccuracy(
      purposeKey,
      resolve,
      reject
    );
  });
}
