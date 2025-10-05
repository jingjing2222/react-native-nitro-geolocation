import { NitroGeolocationHybridObject } from "./NitroGeolocationModule";
import type {
  GeolocationError,
  GeolocationOptions,
  GeolocationPosition
} from "./types";

export function getCurrentPosition(
  success: (position: GeolocationPosition) => void,
  error?: (error: GeolocationError) => void,
  options?: GeolocationOptions
): void {
  NitroGeolocationHybridObject.getCurrentPosition(success, error, options);
}
