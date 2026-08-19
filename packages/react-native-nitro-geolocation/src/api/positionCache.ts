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

export function clearLastKnownPositionCache(): void {
  lastKnownPosition = undefined;
}
