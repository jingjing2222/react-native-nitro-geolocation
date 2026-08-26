import {
  type CurrentPositionOptions,
  getAbortReason
} from "../api/currentPositionOptions";
import { buildLocationMetadata } from "../api/locationMetadata";
import { buildLocationReadiness } from "../api/locationReadiness";
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
  LastKnownPositionOptions,
  LocationAvailability,
  LocationProviderStatus,
  LocationReadiness,
  LocationSettingsOptions,
  LocationSettingsResult,
  PermissionDetails,
  PermissionStatus,
  ReverseGeocodedAddress
} from "../publicTypes";
import { type LocationError, LocationErrorCodes } from "../utils/errors";
import {
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
import {
  applyRecentWebPermissionEvidence,
  clearWebPermissionEvidence,
  rememberWebPermissionDenial,
  rememberWebPermissionGrant
} from "./permissionEvidence";
export {
  getActiveWatches,
  stopObserving,
  unwatch,
  watchHeading,
  watchPosition,
  watchProviderStatus
} from "./watch";
export { useWatchPosition } from "./useWatchPosition";
export type {
  UseWatchPositionOptions,
  UseWatchPositionResult
} from "../hooks/types";

export function setConfiguration(_config: GeolocationConfiguration): void {
  // Browser geolocation has no global configuration API.
}

export async function checkPermission(): Promise<PermissionStatus> {
  const browserNavigator = getNavigator();
  if (!browserNavigator?.geolocation) {
    clearWebPermissionEvidence();
    return "denied";
  }

  try {
    const status = await browserNavigator.permissions?.query({
      name: "geolocation"
    });
    const permission = status
      ? mapPermissionState(status.state)
      : "undetermined";
    if (status) {
      clearWebPermissionEvidence();
    }
    return permission;
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
    if (
      (error as LocationError).code === LocationErrorCodes.PERMISSION_DENIED
    ) {
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

function buildWebLocationAvailability(
  environmentSupported: boolean,
  permission: PermissionStatus
): LocationAvailability {
  if (!environmentSupported) {
    return {
      available: false,
      reason: "unsupported"
    };
  }
  if (permission === "denied" || permission === "restricted") {
    return {
      available: false,
      reason: "permissionDenied"
    };
  }

  return { available: true };
}

export async function getLocationAvailability(): Promise<LocationAvailability> {
  const environmentSupported = Boolean(getGeolocation());
  if (!environmentSupported) {
    return buildWebLocationAvailability(false, "denied");
  }

  const permission = applyRecentWebPermissionEvidence(
    await checkPermission(),
    Date.now()
  );
  return buildWebLocationAvailability(true, permission);
}

export async function getLocationReadiness(): Promise<LocationReadiness> {
  const environmentSupported = Boolean(getGeolocation());
  const permission = await checkPermission();
  const now = Date.now();
  const observedPermission = applyRecentWebPermissionEvidence(permission, now);
  const providerStatus: LocationProviderStatus = {
    locationServicesEnabled: environmentSupported,
    backgroundModeEnabled: false
  };
  const availability = buildWebLocationAvailability(
    environmentSupported,
    observedPermission
  );
  const cachedPosition = readLastKnownPosition(now);

  return buildLocationReadiness({
    permission: observedPermission,
    deniedPermissionIsAmbiguous:
      permission === "undetermined" && observedPermission === "denied",
    environmentSupported,
    providerStatus,
    availability,
    cachedPosition,
    now
  });
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

/** Detailed alias for the deterministic settings result used by native. */
export function requestLocationSettingsDetailed(
  options?: LocationSettingsOptions
): Promise<LocationSettingsResult> {
  return requestLocationSettings(options);
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
    clearWebPermissionEvidence();
    clearWebPermissionDetailsEvidence();
    return rejectUnsupported();
  }

  const requestedAt = Date.now();
  const maximumAge = options?.maximumAge ?? 0;
  const observePosition = (
    position: Parameters<typeof normalizePosition>[0]
  ): GeolocationResponse => {
    const observedAt = Date.now();
    rememberWebPermissionGrant(observedAt);
    rememberWebPermissionDetailsEvidence("granted", observedAt);
    const normalizedPosition = normalizePosition(position);
    normalizedPosition.metadata = buildLocationMetadata(normalizedPosition, {
      source: "currentPosition",
      maximumAge,
      requestedAt,
      observedAt
    });
    return rememberPosition(normalizedPosition);
  };
  const observeError = (
    error: Parameters<typeof mapBrowserError>[0]
  ): LocationError => {
    const mappedError = mapBrowserError(error);
    if (mappedError.code === LocationErrorCodes.PERMISSION_DENIED) {
      const observedAt = Date.now();
      rememberWebPermissionDenial(observedAt);
      rememberWebPermissionDetailsEvidence("denied", observedAt);
    }
    return mappedError;
  };

  if (!signal) {
    return new Promise((resolve, reject) => {
      geolocation.getCurrentPosition(
        (position) => resolve(observePosition(position)),
        (error) => reject(observeError(error)),
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
      (position) => finish(() => resolve(observePosition(position))),
      (error) => finish(() => reject(observeError(error))),
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
  options?: LastKnownPositionOptions
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
