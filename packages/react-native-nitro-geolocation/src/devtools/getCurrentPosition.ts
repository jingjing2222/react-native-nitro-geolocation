import type { GeolocationResponse } from "../publicTypes";
import { LocationErrorCode, createLocationError } from "../utils/errors";
import { getDevtoolsState } from "./index";

export function getDevtoolsCurrentPosition(): Promise<GeolocationResponse> | null {
  const devtools = getDevtoolsState();
  if (devtools.position) {
    return Promise.resolve(devtools.position);
  }
  // Devtools is JS-only, but keep the public rejection shape aligned.
  return Promise.reject(
    createLocationError(
      LocationErrorCode.INTERNAL_ERROR,
      "Geolocation devtools not connected. Press 'j' in Metro to open devtools and enable the geolocation plugin."
    )
  );
}
