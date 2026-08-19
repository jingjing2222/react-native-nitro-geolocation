import type {
  LocationError,
  LocationRequestOptions,
  LocationSettingsOptions,
  PermissionStatus
} from "../NitroGeolocation.nitro";
import { decoratePositionWithMetadata } from "../api/locationMetadata";
import {
  type CurrentPositionOptions,
  getAbortReason
} from "../api/currentPositionOptions";
import {
  readLastKnownPosition,
  rememberPosition,
  selectCachedPosition
} from "../api/positionCache";
import type {
  AccuracyAuthorization,
  GeocodedLocation,
  GeocodingCoordinates,
  GeolocationConfiguration,
  GeolocationResponse,
  Heading,
  LocationAvailability,
  LocationProviderStatus,
  LocationSettingsResult,
  ReverseGeocodedAddress
} from "../publicTypes";
import { LocationErrorCode } from "../utils/errors";
import {
  createUnsupportedError,
  getGeolocation,
  getNavigator,
  mapBrowserError,
  mapPermissionState,
  normalizePosition,
  rejectUnsupported,
  toPositionOptions
} from "./browser";
export { stopObserving, unwatch, watchHeading, watchPosition } from "./watch";
export {
  useWatchPosition,
  type UseWatchPositionOptions
} from "./useWatchPosition";

export function setConfiguration(_config: GeolocationConfiguration): void {
  // Browser geolocation has no global configuration API.
}

export async function checkPermission(): Promise<PermissionStatus> {
  const browserNavigator = getNavigator();
  if (!browserNavigator?.geolocation) {
    return "denied";
  }

  try {
    const status = await browserNavigator.permissions?.query({
      name: "geolocation"
    });
    return status ? mapPermissionState(status.state) : "undetermined";
  } catch {
    return "undetermined";
  }
}

export async function requestPermission(): Promise<PermissionStatus> {
  const currentStatus = await checkPermission();
  if (currentStatus === "granted" || currentStatus === "denied") {
    return currentStatus;
  }

  try {
    await getCurrentPosition({ maximumAge: 0, timeout: 10000 });
    return "granted";
  } catch (error) {
    if ((error as LocationError).code === LocationErrorCode.PERMISSION_DENIED) {
      return "denied";
    }
    return checkPermission();
  }
}

export function hasServicesEnabled(): Promise<boolean> {
  return Promise.resolve(Boolean(getGeolocation()));
}

export function getProviderStatus(): Promise<LocationProviderStatus> {
  const enabled = Boolean(getGeolocation());
  return Promise.resolve({
    locationServicesEnabled: enabled,
    backgroundModeEnabled: false
  });
}

export async function getLocationAvailability(): Promise<LocationAvailability> {
  if (!getGeolocation()) {
    return {
      available: false,
      reason: createUnsupportedError().message
    };
  }

  const permission = await checkPermission();
  if (permission === "denied" || permission === "restricted") {
    return {
      available: false,
      reason: "Browser geolocation permission is denied."
    };
  }

  return { available: true };
}

export function requestLocationSettings(
  _options?: LocationSettingsOptions
): Promise<LocationSettingsResult> {
  return getProviderStatus().then((providerStatus) => ({
    outcome: providerStatus.locationServicesEnabled
      ? "satisfied"
      : "unavailable",
    providerStatus
  }));
}

export function getAccuracyAuthorization(): Promise<AccuracyAuthorization> {
  return checkPermission().then((status) =>
    status === "granted" ? "full" : "unknown"
  );
}

export function requestTemporaryFullAccuracy(
  _purposeKey: string
): Promise<AccuracyAuthorization> {
  return getAccuracyAuthorization();
}

export function getCurrentPosition(
  options?: CurrentPositionOptions
): Promise<GeolocationResponse> {
  const signal = options?.signal;
  if (signal?.aborted) {
    return Promise.reject(getAbortReason(signal));
  }

  const geolocation = getGeolocation();
  if (!geolocation) {
    return rejectUnsupported();
  }

  if (!signal) {
    return new Promise((resolve, reject) => {
      geolocation.getCurrentPosition(
        (position) => resolve(rememberPosition(normalizePosition(position))),
        (error) => reject(mapBrowserError(error)),
        toPositionOptions(options)
      );
    });
  }

  return new Promise((resolve, reject) => {
    const requestWatch: { id?: number } = {};
    let shouldClearWatch = false;
    let didClearWatch = false;
    let settled = false;

    const clearRequestWatch = () => {
      if (didClearWatch) return;
      if (requestWatch.id === undefined) {
        shouldClearWatch = true;
        return;
      }
      didClearWatch = true;
      geolocation.clearWatch(requestWatch.id);
    };
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", handleAbort);
      clearRequestWatch();
      callback();
    };
    const handleAbort = () => finish(() => reject(getAbortReason(signal)));

    signal.addEventListener("abort", handleAbort, { once: true });
    requestWatch.id = geolocation.watchPosition(
      (position) =>
        finish(() => resolve(rememberPosition(normalizePosition(position)))),
      (error) => finish(() => reject(mapBrowserError(error))),
      toPositionOptions(options)
    );
    if (shouldClearWatch) {
      clearRequestWatch();
    }
  });
}

export function getLastKnownPosition(): GeolocationResponse | undefined {
  return readLastKnownPosition();
}

export function getLastKnownPositionAsync(
  options?: LocationRequestOptions
): Promise<GeolocationResponse | undefined> {
  const maximumAge = options?.maximumAge ?? Number.POSITIVE_INFINITY;
  return Promise.resolve(
    selectCachedPosition(readLastKnownPosition(), maximumAge)
  );
}

export function geocode(_address: string): Promise<GeocodedLocation[]> {
  return rejectUnsupported();
}

export function reverseGeocode(
  _coords: GeocodingCoordinates
): Promise<ReverseGeocodedAddress[]> {
  return rejectUnsupported();
}

export function getHeading(): Promise<Heading> {
  return rejectUnsupported();
}
