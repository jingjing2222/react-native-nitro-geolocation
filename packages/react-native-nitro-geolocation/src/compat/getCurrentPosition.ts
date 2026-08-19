import { NitroGeolocationHybridCompatObject } from "../NitroGeolocationModule";
import type {
  CompatGeolocationError,
  CompatGeolocationOptions,
  CompatGeolocationOptionsWithMetadata,
  CompatGeolocationResponse,
  CompatGeolocationResponseWithMetadata
} from "../publicTypes";
import {
  toCompatResponse,
  toCompatResponseWithMetadata,
  toNativeCompatOptions
} from "./metadata";

export function getCurrentPosition(
  success: (position: CompatGeolocationResponseWithMetadata) => void,
  error: ((error: CompatGeolocationError) => void) | undefined,
  options: CompatGeolocationOptionsWithMetadata
): void;
export function getCurrentPosition(
  success: (position: CompatGeolocationResponse) => void,
  error?: (error: CompatGeolocationError) => void,
  options?: CompatGeolocationOptions
): void;
export function getCurrentPosition(
  success: (position: CompatGeolocationResponseWithMetadata) => void,
  error?: (error: CompatGeolocationError) => void,
  options?: CompatGeolocationOptions
): void {
  const nativeOptions = toNativeCompatOptions(options);

  if (options?.includeExtraMetadata === true) {
    NitroGeolocationHybridCompatObject.getCurrentPositionWithMetadata(
      (position) => success(toCompatResponseWithMetadata(position)),
      nativeOptions,
      error
    );
    return;
  }

  NitroGeolocationHybridCompatObject.getCurrentPosition(
    (position) => success(toCompatResponse(position)),
    nativeOptions,
    error
  );
}
