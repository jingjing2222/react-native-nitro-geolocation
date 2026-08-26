import { decoratePositionWithMetadata } from "../api/locationMetadata";
import { rememberPosition } from "../api/positionCache";
import type {
  ActiveWatch,
  GeolocationResponse,
  Heading,
  HeadingOptions,
  LocationProviderStatus,
  LocationRequestOptions
} from "../publicTypes";
import { type LocationError, LocationErrorCodes } from "../utils/errors";
import {
  createUnsupportedError,
  distanceMeters,
  getGeolocation,
  mapBrowserError,
  normalizePosition,
  toPositionOptions
} from "./browser";
import {
  clearWebPermissionDetailsEvidence,
  rememberWebPermissionDetailsEvidence
} from "./permissionDetailsEvidence";
import {
  clearWebPermissionEvidence,
  rememberWebPermissionDenial,
  rememberWebPermissionGrant
} from "./permissionEvidence";

const activeWatches = new Map<string, number>();
type ProviderStatusSubscription = {
  success: (status: LocationProviderStatus) => void;
  lastStatus?: LocationProviderStatus;
};
type LifecycleTarget = {
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};
const providerStatusSubscriptions = new Map<
  string,
  ProviderStatusSubscription
>();
let providerStatusRegistrations: Array<{
  event: string;
  target: LifecycleTarget;
}> = [];
let nextWatchId = 1;
let providerRefreshGeneration = 0;

function getLifecycleTarget(): LifecycleTarget {
  return globalThis as unknown as LifecycleTarget;
}

function readProviderStatus(): LocationProviderStatus {
  return {
    locationServicesEnabled: Boolean(getGeolocation()),
    backgroundModeEnabled: false
  };
}

function sameProviderStatus(
  first: LocationProviderStatus | undefined,
  second: LocationProviderStatus
): boolean {
  return (
    first?.locationServicesEnabled === second.locationServicesEnabled &&
    first?.backgroundModeEnabled === second.backgroundModeEnabled
  );
}

function refreshProviderStatus(): void {
  const generation = ++providerRefreshGeneration;
  Promise.resolve().then(() => {
    if (generation !== providerRefreshGeneration) return;

    const status = readProviderStatus();
    for (const subscription of providerStatusSubscriptions.values()) {
      if (sameProviderStatus(subscription.lastStatus, status)) continue;
      subscription.lastStatus = status;
      subscription.success(status);
    }
  });
}

function startProviderStatusEvents(): void {
  const lifecycleGlobal = getLifecycleTarget();
  const lifecycleDocument = (
    globalThis as typeof globalThis & { document?: LifecycleTarget }
  ).document;
  providerStatusRegistrations = [
    { event: "focus", target: lifecycleGlobal },
    { event: "pageshow", target: lifecycleGlobal },
    ...(lifecycleDocument
      ? [{ event: "visibilitychange", target: lifecycleDocument }]
      : [])
  ];
  for (const { event, target } of providerStatusRegistrations) {
    target.addEventListener?.(event, refreshProviderStatus);
  }
}

function stopProviderStatusEvents(): void {
  for (const { event, target } of providerStatusRegistrations) {
    target.removeEventListener?.(event, refreshProviderStatus);
  }
  providerStatusRegistrations = [];
}

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
    clearWebPermissionEvidence();
    clearWebPermissionDetailsEvidence();
    error?.(createUnsupportedError());
    return token;
  }

  let lastEmittedLatitude: number | undefined;
  let lastEmittedLongitude: number | undefined;
  const requestedAt = Date.now();
  const distanceFilter = options?.distanceFilter ?? 0;
  const watchId = geolocation.watchPosition(
    (position) => {
      rememberWebPermissionGrant();
      rememberWebPermissionDetailsEvidence("granted");
      if (
        distanceFilter > 0 &&
        lastEmittedLatitude !== undefined &&
        lastEmittedLongitude !== undefined &&
        distanceMeters(
          lastEmittedLatitude,
          lastEmittedLongitude,
          position.coords.latitude,
          position.coords.longitude
        ) < distanceFilter
      ) {
        return;
      }
      const normalizedPosition = decoratePositionWithMetadata(
        normalizePosition(position),
        {
          source: "watchPosition",
          maximumAge: options?.maximumAge ?? 0,
          requestedAt
        }
      );
      lastEmittedLatitude = position.coords.latitude;
      lastEmittedLongitude = position.coords.longitude;
      success(rememberPosition(normalizedPosition));
    },
    (browserError) => {
      const mappedError = mapBrowserError(browserError);
      if (mappedError.code === LocationErrorCodes.PERMISSION_DENIED) {
        rememberWebPermissionDenial();
        rememberWebPermissionDetailsEvidence("denied");
      }
      error?.(mappedError);
    },
    toPositionOptions(options)
  );

  activeWatches.set(token, watchId);
  return token;
}

export function watchProviderStatus(
  success: (status: LocationProviderStatus) => void
): string {
  const token = `web-provider-${nextWatchId++}`;
  const shouldStartEvents = providerStatusSubscriptions.size === 0;
  providerStatusSubscriptions.set(token, { success });
  if (shouldStartEvents) startProviderStatusEvents();
  refreshProviderStatus();
  return token;
}

export function unwatch(token: string): void {
  if (providerStatusSubscriptions.delete(token)) {
    if (providerStatusSubscriptions.size === 0) {
      providerRefreshGeneration++;
      stopProviderStatusEvents();
    }
    return;
  }

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
  for (const token of providerStatusSubscriptions.keys()) {
    unwatch(token);
  }
}
