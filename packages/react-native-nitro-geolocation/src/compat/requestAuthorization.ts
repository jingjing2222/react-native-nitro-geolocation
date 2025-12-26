import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
import type { GeolocationError } from "../types";

export function requestAuthorization(
  success?: () => void,
  error?: (error: GeolocationError) => void
): void {
  NitroGeolocationHybridObject.requestAuthorization(success, error);
}
