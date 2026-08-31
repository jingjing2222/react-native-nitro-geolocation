import { Platform } from "react-native";
import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
import { isDevtoolsEnabled } from "../devtools";
import { devtoolsWatchPosition } from "../devtools/watchPosition";
import type { LocationRequestOptions } from "../publicTypes";
import type { GeolocationResponse } from "../publicTypes";
import type { LocationError } from "../utils/errors";
import { decoratePositionWithMetadata } from "./locationMetadata";
import { rememberPosition } from "./positionCache";

/**
 * Start watching for continuous location updates.
 *
 * IMPORTANT: This is a LOW-LEVEL API.
 * For React components, use useWatchPosition() hook instead.
 *
 * @param success - Called on each successful location update
 * @param error - Called when an error occurs
 * @param options - Location request options
 * @returns Subscription token (UUID string) for cleanup
 * @example
 * ```tsx
 * import { watchPosition, unwatch } from 'react-native-nitro-geolocation';
 *
 * const token = watchPosition(
 *   (position) => console.log(position.coords),
 *   (error) => console.error(error.message),
 *   { accuracy: { android: "high", ios: "best" }, distanceFilter: 10 }
 * );
 *
 * // Later: cleanup
 * unwatch(token);
 * ```
 */
export function watchPosition(
  success: (position: GeolocationResponse) => void,
  error?: (error: LocationError) => void,
  options?: LocationRequestOptions
): string {
  const requestedAt = Date.now();
  const rememberAndNotify = (position: GeolocationResponse) => {
    success(
      rememberPosition(
        decoratePositionWithMetadata(position, {
          source: "watchPosition",
          maximumAge: options?.maximumAge ?? 0,
          requestedAt
        })
      )
    );
  };

  if (isDevtoolsEnabled()) {
    return devtoolsWatchPosition(
      rememberAndNotify,
      error,
      options,
      Platform.OS === "android" ? "android" : "ios"
    );
  }
  return NitroGeolocationHybridObject.watchPosition(
    rememberAndNotify,
    options ?? {},
    error
  );
}
