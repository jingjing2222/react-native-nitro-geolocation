import { NitroGeolocationHybridCompatObject } from "../NitroGeolocationModule";
import type {
  GeolocationError,
  GeolocationOptions,
  GeolocationResponse
} from "../types";

export function getCurrentPosition(
  success: (position: GeolocationResponse) => void,
  error?: (error: GeolocationError) => void,
  options?: GeolocationOptions
): void {
  NitroGeolocationHybridCompatObject.getCurrentPosition(
    success,
    error,
    options
  );
}
