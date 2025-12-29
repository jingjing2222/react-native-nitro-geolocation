import type { LocationRequestOptions } from "../NitroGeolocation.nitro";
import type { GeolocationResponse } from "../types";
import { getDevtoolsState } from "./index";

export function getDevtoolsCurrentPosition(
  options?: LocationRequestOptions
): Promise<GeolocationResponse> | null {
  const devtools = getDevtoolsState();
  // Always return position if available (even if null initially will be set by devtools)
  if (devtools.position) {
    return Promise.resolve(devtools.position);
  }
  // If no position yet, wait a bit for devtools to send initial position
  return new Promise((resolve, reject) => {
    const checkPosition = () => {
      if (devtools.position) {
        resolve(devtools.position);
      } else {
        // Check again after a short delay
        setTimeout(checkPosition, 100);
      }
    };
    checkPosition();
  });
}
