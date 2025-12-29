import type { LocationRequestOptions } from "../NitroGeolocation.nitro";
import type { GeolocationResponse } from "../types";
import { getDevtoolsState } from "./index";

export function getDevtoolsCurrentPosition(
  options?: LocationRequestOptions
): Promise<GeolocationResponse> | null {
  const devtools = getDevtoolsState();
  if (devtools.position) {
    return Promise.resolve(devtools.position);
  }
  return null;
}
