import type {
  GeolocationPosition,
  GeolocationError,
  GeolocationOptions
} from "./types";
import { NitroGeolocationHybridObject } from "./NitroGeolocationModule";

export function getCurrentPosition(
  success: (position: GeolocationPosition) => void,
  error?: (error: GeolocationError) => void,
  options?: GeolocationOptions
): void {
  NitroGeolocationHybridObject.getCurrentPosition(success, error, options);
}
