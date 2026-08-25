import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
import { isDevtoolsEnabled } from "../devtools";
import { getDevtoolsLastKnownPosition } from "../devtools/getLastKnownPosition";
import type {
  GeolocationResponse,
  LastKnownPositionOptions
} from "../publicTypes";
import { LocationErrorCodes } from "../utils/errors";
import { decoratePositionWithMetadata } from "./locationMetadata";
import { readLastKnownPosition, rememberPosition } from "./positionCache";

/**
 * Return the latest position observed by this JavaScript module.
 *
 * This synchronous read never calls a native or browser location source.
 * It returns `undefined` until a Modern current, watch, or async cache call
 * observes a position.
 */
export function getLastKnownPosition(): GeolocationResponse | undefined {
  return readLastKnownPosition();
}

/**
 * Query cached platform/provider sources without starting a fresh location
 * request.
 *
 * Native platforms may query their cache-only APIs. DevTools filters its
 * configured mock cache. Web filters the observed module cache because the
 * browser Geolocation API has no cache-only request that can avoid prompting
 * or starting location acquisition.
 *
 * @param options - Cache filtering and provider selection options
 * @returns A cached position, or `undefined` when no cache satisfies options
 * @throws LocationError if permission is denied or the cache query fails
 */
export function getLastKnownPositionAsync(
  options?: LastKnownPositionOptions
): Promise<GeolocationResponse | undefined> {
  const requestedAt = Date.now();
  const rememberPlatformCache = (position: GeolocationResponse) =>
    rememberPosition(
      decoratePositionWithMetadata(position, {
        source: "platformCache",
        maximumAge: options?.maximumAge ?? Number.POSITIVE_INFINITY,
        requestedAt
      })
    );

  if (isDevtoolsEnabled()) {
    const cached = getDevtoolsLastKnownPosition(options);
    return Promise.resolve(cached ? rememberPlatformCache(cached) : undefined);
  }

  return new Promise<GeolocationResponse>((resolve, reject) => {
    NitroGeolocationHybridObject.getLastKnownPosition(
      (position) => resolve(rememberPlatformCache(position)),
      options ?? {},
      reject
    );
  }).catch((error: unknown) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === LocationErrorCodes.POSITION_UNAVAILABLE
    ) {
      return undefined;
    }
    throw error;
  });
}
