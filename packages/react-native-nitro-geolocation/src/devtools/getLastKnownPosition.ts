import { getDevtoolsState } from ".";
import { selectCachedPosition } from "../api/positionCache";
import type { LastKnownPositionOptions } from "../publicTypes";
import type { GeolocationResponse } from "../publicTypes";

export function getDevtoolsLastKnownPosition(
  options?: LastKnownPositionOptions,
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
