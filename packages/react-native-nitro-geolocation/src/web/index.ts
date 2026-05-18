import type {
  LocationError,
  LocationRequestOptions,
  LocationSettingsOptions,
  PermissionStatus
} from "../NitroGeolocation.nitro";
import type {
  AccuracyAuthorization,
  GeocodedLocation,
  GeocodingCoordinates,
  GeolocationConfiguration,
  GeolocationResponse,
  Heading,
  LocationAvailability,
  LocationProviderStatus,
  ReverseGeocodedAddress
} from "../publicTypes";
import { LocationErrorCode, createLocationError } from "../utils/errors";
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
): Promise<LocationProviderStatus> {
  return getProviderStatus();
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
  options?: LocationRequestOptions
): Promise<GeolocationResponse> {
  const geolocation = getGeolocation();
  if (!geolocation) {
    return rejectUnsupported();
  }

  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      (position) => resolve(normalizePosition(position)),
      (error) => reject(mapBrowserError(error)),
      toPositionOptions(options)
    );
  });
}

export function getLastKnownPosition(
  options?: LocationRequestOptions
): Promise<GeolocationResponse> {
  const maximumAge = options?.maximumAge ?? Number.POSITIVE_INFINITY;
  return getCurrentPosition({ ...options, maximumAge, timeout: 0 }).catch(
    (error) => {
      if ((error as LocationError).code === LocationErrorCode.TIMEOUT) {
        throw createLocationError(
          LocationErrorCode.POSITION_UNAVAILABLE,
          "No cached browser location is available."
        );
      }
      throw error;
    }
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
