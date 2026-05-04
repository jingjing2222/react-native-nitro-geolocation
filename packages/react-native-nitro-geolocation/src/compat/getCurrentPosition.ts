import { NitroGeolocationHybridCompatObject } from "../NitroGeolocationModule";
import type {
  CompatGeolocationResponse,
  GeolocationError,
  GeolocationOptions
} from "../publicTypes";

export function getCurrentPosition(
  success: (position: CompatGeolocationResponse) => void,
  error?: (error: GeolocationError) => void,
  options?: GeolocationOptions
): void {
  NitroGeolocationHybridCompatObject.getCurrentPosition(
    success,
    error,
    options
  );
}
