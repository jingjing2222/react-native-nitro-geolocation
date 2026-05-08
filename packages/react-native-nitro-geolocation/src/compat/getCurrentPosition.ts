import { NitroGeolocationHybridCompatObject } from "../NitroGeolocationModule";
import type {
  CompatGeolocationError,
  CompatGeolocationOptions,
  CompatGeolocationResponse
} from "../publicTypes";

export function getCurrentPosition(
  success: (position: CompatGeolocationResponse) => void,
  error?: (error: CompatGeolocationError) => void,
  options?: CompatGeolocationOptions
): void {
  NitroGeolocationHybridCompatObject.getCurrentPosition(
    success,
    options ?? {},
    error
  );
}
