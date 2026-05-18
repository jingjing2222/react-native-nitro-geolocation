import type {
  LocationError,
  LocationRequestOptions
} from "../NitroGeolocation.nitro";
import type {
  GeolocationResponse,
  Heading,
  HeadingOptions
} from "../publicTypes";
import {
  createUnsupportedError,
  distanceMeters,
  getGeolocation,
  mapBrowserError,
  normalizePosition,
  toPositionOptions
} from "./browser";

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
  const watchId = geolocation.watchPosition(
    (position) => {
      const normalizedPosition = normalizePosition(position);
      const filter = options?.distanceFilter ?? 0;
      if (
        filter <= 0 ||
        !lastEmitted ||
        distanceMeters(lastEmitted, normalizedPosition) >= filter
      ) {
        lastEmitted = normalizedPosition;
        success(normalizedPosition);
      }
    },
    (browserError) => error?.(mapBrowserError(browserError)),
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

export function stopObserving(): void {
  for (const token of activeWatches.keys()) {
    unwatch(token);
  }
}
