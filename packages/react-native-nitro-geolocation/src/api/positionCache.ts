import type { GeolocationResponse } from "../publicTypes";

let lastKnownPosition: GeolocationResponse | undefined;

export function rememberPosition(
  position: GeolocationResponse
): GeolocationResponse {
  lastKnownPosition = position;
  return position;
}

export function readLastKnownPosition(): GeolocationResponse | undefined {
  return lastKnownPosition;
}

export function selectCachedPosition(
  position: GeolocationResponse | undefined,
  maximumAge: number,
  currentTime = Date.now()
): GeolocationResponse | undefined {
  if (!position) {
    return undefined;
  }
  if (maximumAge === Number.POSITIVE_INFINITY) {
    return position;
  }

  const age = Math.max(0, currentTime - position.timestamp);
  return age < maximumAge ? position : undefined;
}

export function clearLastKnownPositionCache(): void {
  lastKnownPosition = undefined;
}
