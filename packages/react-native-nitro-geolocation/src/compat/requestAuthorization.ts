import { NitroGeolocationHybridCompatObject } from "../NitroGeolocationModule";
import type { CompatGeolocationError } from "../publicTypes";

export function requestAuthorization(
  success?: () => void,
  error?: (error: CompatGeolocationError) => void
): void {
  NitroGeolocationHybridCompatObject.requestAuthorization(success, error);
}
