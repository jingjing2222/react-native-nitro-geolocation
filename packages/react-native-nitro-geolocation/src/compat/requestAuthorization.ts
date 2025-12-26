import { NitroGeolocationHybridCompatObject } from "../NitroGeolocationModule";
import type { GeolocationError } from "../types";

export function requestAuthorization(
  success?: () => void,
  error?: (error: GeolocationError) => void
): void {
  NitroGeolocationHybridCompatObject.requestAuthorization(success, error);
}
