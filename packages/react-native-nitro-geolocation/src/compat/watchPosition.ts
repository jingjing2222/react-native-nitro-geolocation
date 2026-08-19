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

/**
 * Invokes the success callback whenever the location changes.
 * Returns a watchId (number) that can be used with clearWatch().
 *
 * @param success - Called whenever the location changes
 * @param error - Called if an error occurs
 * @param options - Configuration options for watching position
 * @returns watchId - A number that identifies this watch session
 */
export function watchPosition(
  success: (position: CompatGeolocationResponseWithMetadata) => void,
  error: ((error: CompatGeolocationError) => void) | undefined,
  options: CompatGeolocationOptionsWithMetadata
): number;
export function watchPosition(
  success: (position: CompatGeolocationResponse) => void,
  error?: (error: CompatGeolocationError) => void,
  options?: CompatGeolocationOptions
): number;
export function watchPosition(
  success: (position: CompatGeolocationResponseWithMetadata) => void,
  error?: (error: CompatGeolocationError) => void,
  options?: CompatGeolocationOptions
): number {
  const nativeOptions = toNativeCompatOptions(options);

  if (options?.includeExtraMetadata === true) {
    return NitroGeolocationHybridCompatObject.watchPositionWithMetadata(
      (position) => success(toCompatResponseWithMetadata(position)),
      nativeOptions,
      error
    );
  }

  return NitroGeolocationHybridCompatObject.watchPosition(
    (position) => success(toCompatResponse(position)),
    nativeOptions,
    error
  );
}
