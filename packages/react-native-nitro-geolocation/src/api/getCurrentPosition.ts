import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
import { isDevtoolsEnabled } from "../devtools";
import { getDevtoolsCurrentPosition } from "../devtools/getCurrentPosition";
import type { GeolocationResponse } from "../publicTypes";
import {
  type CurrentPositionOptions,
  getAbortReason,
  getNativeCurrentPositionOptions
} from "./currentPositionOptions";
import { rememberPosition } from "./positionCache";

let nextCurrentPositionRequestId = 1;

function createCurrentPositionRequestId(): string {
  const requestId = `current-position-${nextCurrentPositionRequestId}`;
  nextCurrentPositionRequestId += 1;
  return requestId;
}

function raceDevtoolsRequestWithSignal(
  request: Promise<GeolocationResponse>,
  signal: AbortSignal
): Promise<GeolocationResponse> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", handleAbort);
      callback();
    };
    const handleAbort = () => finish(() => reject(getAbortReason(signal)));

    signal.addEventListener("abort", handleAbort, { once: true });
    request.then(
      (position) => finish(() => resolve(rememberPosition(position))),
      (error) => finish(() => reject(error))
    );
  });
}

/**
 * Get current location (one-time request).
 *
 * Strategy:
 * 1. Check cached location (if maximumAge allows)
 * 2. Request fresh location from the configured native provider
 * 3. Timeout after specified duration
 *
 * @param options - Location request options
 * @returns Promise resolving to current position
 * @throws LocationError if permission denied, timeout, or unavailable
 * @example
 * ```tsx
 * import { getCurrentPosition } from 'react-native-nitro-geolocation';
 *
 * try {
 *   const position = await getCurrentPosition({
 *     accuracy: { android: "high", ios: "best" },
 *     timeout: 15000
 *   });
 *   console.log(position.coords.latitude, position.coords.longitude);
 * } catch (error) {
 *   console.error(error.message);
 * }
 * ```
 */
export function getCurrentPosition(
  options?: CurrentPositionOptions
): Promise<GeolocationResponse> {
  const signal = options?.signal;
  if (signal?.aborted) {
    return Promise.reject(getAbortReason(signal));
  }

  if (isDevtoolsEnabled()) {
    const devtoolsResult = getDevtoolsCurrentPosition();
    if (devtoolsResult) {
      if (signal) {
        return raceDevtoolsRequestWithSignal(devtoolsResult, signal);
      }
      return devtoolsResult.then(rememberPosition);
    }
  }

  const nativeOptions = getNativeCurrentPositionOptions(options);
  if (!signal) {
    return new Promise((resolve, reject) => {
      NitroGeolocationHybridObject.getCurrentPosition(
        (position) => resolve(rememberPosition(position)),
        nativeOptions,
        reject
      );
    });
  }

  return new Promise((resolve, reject) => {
    const requestId = createCurrentPositionRequestId();
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", handleAbort);
      callback();
    };
    const handleAbort = () => {
      finish(() => {
        NitroGeolocationHybridObject.cancelCurrentPositionRequest(requestId);
        reject(getAbortReason(signal));
      });
    };

    signal.addEventListener("abort", handleAbort, { once: true });
    NitroGeolocationHybridObject.getCurrentPositionCancellable(
      requestId,
      (position) => finish(() => resolve(rememberPosition(position))),
      nativeOptions,
      (error) => finish(() => reject(error))
    );
  });
}
