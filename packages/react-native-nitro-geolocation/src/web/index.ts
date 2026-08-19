import type {
  LocationError,
  LocationRequestOptions,
  LocationSettingsOptions,
  PermissionStatus
} from "../NitroGeolocation.nitro";
import { buildPermissionDetails } from "../api/permissionDetails";
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
  PermissionDetails,
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
import {
  clearWebPermissionDetailsEvidence,
  readRecentWebPermissionDetailsEvidence,
  rememberWebPermissionDetailsEvidence
} from "./permissionDetailsEvidence";
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

export async function getPermissionDetails(): Promise<PermissionDetails> {
  const browserNavigator = getNavigator();
  if (!browserNavigator?.geolocation) {
    clearWebPermissionDetailsEvidence();
    return buildPermissionDetails({
      platform: "web",
      foreground: "denied",
      background: "unsupported",
      accuracy: "unknown",
      environmentSupported: false,
      canAskAgain: false
    });
  }

  try {
    const permission = await browserNavigator.permissions?.query({
      name: "geolocation"
    });
    if (permission) {
      clearWebPermissionDetailsEvidence();
      const status = mapPermissionState(permission.state);
      return buildPermissionDetails({
        platform: "web",
        foreground: status,
        background: "unsupported",
        accuracy: "unknown",
        canAskAgain: status === "undetermined"
      });
    }

    const observed = readRecentWebPermissionDetailsEvidence();
    const status = observed ?? "undetermined";
    return buildPermissionDetails({
      platform: "web",
      foreground: status,
      background: "unsupported",
      accuracy: "unknown",
      canAskAgain: observed === "granted" ? false : null
    });
  } catch {
    const observed = readRecentWebPermissionDetailsEvidence();
    return buildPermissionDetails({
      platform: "web",
      foreground: observed ?? "undetermined",
      background: "unsupported",
      accuracy: "unknown",
      canAskAgain: observed === "granted" ? false : null
    });
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
  options?: LocationRequestOptions
): Promise<GeolocationResponse> {
  const geolocation = getGeolocation();
  if (!geolocation) {
    return rejectUnsupported();
  }

  const requestedAt = Date.now();
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      (position) => {
        rememberWebPermissionDetailsEvidence("granted");
        resolve(rememberPosition(normalizePosition(position)));
      },
      (error) => {
        const mappedError = mapBrowserError(error);
        if (mappedError.code === LocationErrorCode.PERMISSION_DENIED) {
          rememberWebPermissionDetailsEvidence("denied");
        }
        reject(mappedError);
      },
      toPositionOptions(options)
    );
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
