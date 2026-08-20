import type {
  LocationError,
  LocationRequestOptions
} from "../NitroGeolocation.nitro";
import { decoratePositionWithMetadata } from "../api/locationMetadata";
import { rememberPosition } from "../api/positionCache";
import type {
  ActiveWatch,
  GeolocationResponse,
  Heading,
  HeadingOptions
} from "../publicTypes";
import { LocationErrorCode } from "../utils/errors";
import {
  createUnsupportedError,
  distanceMeters,
  getGeolocation,
  mapBrowserError,
  normalizePosition,
  toPositionOptions
} from "./browser";
import {
  clearWebPermissionEvidence,
  rememberWebPermissionGrant
} from "./permissionEvidence";

const activeWatches = new Map<string, number>();
let nextWatchId = 1;

export function watchHeading(
  _success: (heading: Heading) => void,
  error?: (error: LocationError) => void,
  _options?: HeadingOptions
): string {
  const token = `web-heading-${nextWatchId++}`;
  error?.(createUnsupportedError());
  return token;
}

export function watchPosition(
  success: (position: GeolocationResponse) => void,
  error?: (error: LocationError) => void,
  options?: LocationRequestOptions
): string {
  const geolocation = getGeolocation();
  const token = `web-${nextWatchId++}`;

  if (!geolocation) {
    error?.(createUnsupportedError());
    return token;
  }

  let lastEmitted: GeolocationResponse | null = null;
  const requestedAt = Date.now();
  const watchId = geolocation.watchPosition(
    (position) => {
      rememberWebPermissionGrant();
      const normalizedPosition = normalizePosition(position);
      const filter = options?.distanceFilter ?? 0;
      if (
        filter <= 0 ||
        !lastEmitted ||
        distanceMeters(lastEmitted, normalizedPosition) >= filter
      ) {
        lastEmitted = rememberPosition(normalizedPosition);
        success(lastEmitted);
      }
    },
    (browserError) => {
      const mappedError = mapBrowserError(browserError);
      if (mappedError.code === LocationErrorCode.PERMISSION_DENIED) {
        clearWebPermissionEvidence();
      }
      error?.(mappedError);
    },
    toPositionOptions(options)
  );

  activeWatches.set(token, watchId);
  return token;
}

export function unwatch(token: string): void {
  const watchId = activeWatches.get(token);
  if (watchId === undefined) {
    return;
  }

  getGeolocation()?.clearWatch(watchId);
  activeWatches.delete(token);
}

export function getActiveWatches(): ActiveWatch[] {
  return [...activeWatches.keys()]
    .sort((first, second) => first.localeCompare(second))
    .map((token) => ({ token, kind: "position" }));
}

export function stopObserving(): void {
  for (const token of activeWatches.keys()) {
    unwatch(token);
  }
}
