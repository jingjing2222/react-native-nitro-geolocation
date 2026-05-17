import { useEffect, useRef, useState } from "react";
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
  HeadingOptions,
  LocationAvailability,
  LocationProviderStatus,
  ReverseGeocodedAddress
} from "../publicTypes";
import { LocationErrorCode, createLocationError } from "../utils/errors";

type BrowserPermissionState = "granted" | "denied" | "prompt";

type BrowserPermissionStatus = {
  state: BrowserPermissionState;
};

type BrowserPermissions = {
  query(descriptor: { name: "geolocation" }): Promise<BrowserPermissionStatus>;
};

type BrowserCoordinates = {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
};

type BrowserPosition = {
  coords: BrowserCoordinates;
  timestamp: number;
};

type BrowserPositionError = {
  code: number;
  message: string;
};

type BrowserGeolocation = {
  getCurrentPosition(
    success: (position: BrowserPosition) => void,
    error?: (error: BrowserPositionError) => void,
    options?: BrowserPositionOptions
  ): void;
  watchPosition(
    success: (position: BrowserPosition) => void,
    error?: (error: BrowserPositionError) => void,
    options?: BrowserPositionOptions
  ): number;
  clearWatch(watchId: number): void;
};

type BrowserPositionOptions = {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
};

type BrowserNavigator = {
  geolocation?: BrowserGeolocation;
  permissions?: BrowserPermissions;
};

export interface UseWatchPositionOptions extends LocationRequestOptions {
  enabled?: boolean;
}

const activeWatches = new Map<string, number>();
let nextWatchId = 1;

function getNavigator(): BrowserNavigator | undefined {
  const globalNavigator = (globalThis as { navigator?: BrowserNavigator })
    .navigator;
  return globalNavigator;
}

function getGeolocation(): BrowserGeolocation | undefined {
  return getNavigator()?.geolocation;
}

function toPositionOptions(
  options?: LocationRequestOptions
): BrowserPositionOptions | undefined {
  if (!options) {
    return undefined;
  }

  return {
    enableHighAccuracy:
      options.enableHighAccuracy ?? options.accuracy?.android === "high",
    timeout: options.timeout,
    maximumAge: options.maximumAge
  };
}

function normalizePosition(position: BrowserPosition): GeolocationResponse {
  return {
    coords: {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      altitude: position.coords.altitude ?? null,
      accuracy: position.coords.accuracy,
      altitudeAccuracy: position.coords.altitudeAccuracy ?? null,
      heading: position.coords.heading ?? null,
      speed: position.coords.speed ?? null
    },
    timestamp: position.timestamp,
    provider: "unknown"
  };
}

function mapPermissionState(state: BrowserPermissionState): PermissionStatus {
  if (state === "granted") {
    return "granted";
  }
  if (state === "denied") {
    return "denied";
  }
  return "undetermined";
}

function createUnsupportedError(): LocationError {
  return createLocationError(
    LocationErrorCode.POSITION_UNAVAILABLE,
    "Browser geolocation is unavailable. Use a secure context and a browser that supports navigator.geolocation."
  );
}

function mapBrowserError(error: BrowserPositionError): LocationError {
  switch (error.code) {
    case 1:
      return createLocationError(
        LocationErrorCode.PERMISSION_DENIED,
        error.message || "User denied geolocation permission."
      );
    case 3:
      return createLocationError(
        LocationErrorCode.TIMEOUT,
        error.message || "Geolocation request timed out."
      );
    default:
      return createLocationError(
        LocationErrorCode.POSITION_UNAVAILABLE,
        error.message || "Position is unavailable."
      );
  }
}

function rejectUnsupported<T>(): Promise<T> {
  return Promise.reject(createUnsupportedError());
}

function distanceMeters(
  first: GeolocationResponse,
  second: GeolocationResponse
): number {
  const earthRadiusMeters = 6371000;
  const lat1 = (first.coords.latitude * Math.PI) / 180;
  const lat2 = (second.coords.latitude * Math.PI) / 180;
  const deltaLat =
    ((second.coords.latitude - first.coords.latitude) * Math.PI) / 180;
  const deltaLon =
    ((second.coords.longitude - first.coords.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

export function getLocationAvailability(): Promise<LocationAvailability> {
  const available = Boolean(getGeolocation());
  return Promise.resolve({
    available,
    reason: available ? undefined : createUnsupportedError().message
  });
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
  return getCurrentPosition({ ...options, maximumAge, timeout: 0 });
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

export function useWatchPosition(options?: UseWatchPositionOptions) {
  const [position, setPosition] = useState<GeolocationResponse | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [error, setError] = useState<LocationError | null>(null);
  const tokenRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  const optionsRef = useRef(options);
  const enabled = options?.enabled ?? false;

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (tokenRef.current) {
        unwatch(tokenRef.current);
        tokenRef.current = null;
      }
      setIsWatching(false);
      return;
    }

    setIsWatching(true);
    setError(null);
    const token = watchPosition(
      (nextPosition) => {
        if (!isMountedRef.current) {
          return;
        }
        setPosition(nextPosition);
        setError(null);
      },
      (nextError) => {
        if (!isMountedRef.current) {
          return;
        }
        setError(nextError);
      },
      optionsRef.current
    );
    tokenRef.current = token;

    return () => {
      if (token) {
        unwatch(token);
      }
      if (tokenRef.current === token) {
        tokenRef.current = null;
      }
    };
  }, [enabled]);

  return {
    position,
    error,
    isWatching
  };
}
