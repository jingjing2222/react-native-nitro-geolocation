import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
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
  NitroGeolocationHybridObject.getCurrentPosition(success, error, options);
}
