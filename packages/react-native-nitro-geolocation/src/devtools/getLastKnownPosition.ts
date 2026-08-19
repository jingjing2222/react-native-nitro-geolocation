import { getDevtoolsState } from ".";
import type { LocationRequestOptions } from "../NitroGeolocation.nitro";
import { selectCachedPosition } from "../api/positionCache";
import type { GeolocationResponse } from "../publicTypes";

export function getDevtoolsLastKnownPosition(
  options?: LocationRequestOptions,
  currentTime = Date.now()
): GeolocationResponse | undefined {
  const maximumAge = Math.min(
    options?.maximumAge ?? Number.POSITIVE_INFINITY,
    options?.maxUpdateAge ?? Number.POSITIVE_INFINITY
  );

  return selectCachedPosition(
    getDevtoolsState().position ?? undefined,
    maximumAge,
    currentTime
  );
}
