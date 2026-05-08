import type { LocationRequestOptions } from "../NitroGeolocation.nitro";
import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
import { isDevtoolsEnabled } from "../devtools";
import { getDevtoolsCurrentPosition } from "../devtools/getCurrentPosition";
import type { GeolocationResponse } from "../publicTypes";

/**
 * Get the best cached location without starting a fresh native location
 * request.
 *
 * @param options - Cache filtering and provider selection options
 * @returns Promise resolving to a cached position
 * @throws LocationError if permission is denied or no cached location exists
 */
export function getLastKnownPosition(
  options?: LocationRequestOptions
): Promise<GeolocationResponse> {
  if (isDevtoolsEnabled()) {
    const devtoolsResult = getDevtoolsCurrentPosition();
    if (devtoolsResult) {
      return devtoolsResult;
    }
  }

  return new Promise((resolve, reject) => {
    NitroGeolocationHybridObject.getLastKnownPosition(
      resolve,
      options ?? {},
      reject
    );
  });
}
