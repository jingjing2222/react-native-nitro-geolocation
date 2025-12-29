import type { GeolocationResponse } from "../types";
import { getDevtoolsState } from "./index";

export function getDevtoolsCurrentPosition(): Promise<GeolocationResponse> | null {
  const devtools = getDevtoolsState();
  if (devtools.position) {
    return Promise.resolve(devtools.position);
  }
  // Devtools not connected - throw error
  return Promise.reject(
    new Error(
      "Geolocation devtools not connected. Press 'j' in Metro to open devtools and enable the geolocation plugin."
    )
  );
}
