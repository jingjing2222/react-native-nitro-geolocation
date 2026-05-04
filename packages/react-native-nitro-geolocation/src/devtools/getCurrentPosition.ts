import type { ModernGeolocationResponse } from "../publicTypes";
import { getDevtoolsState } from "./index";

export function getDevtoolsCurrentPosition(): Promise<ModernGeolocationResponse> | null {
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
