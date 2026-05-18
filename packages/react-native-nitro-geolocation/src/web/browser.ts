import type {
  LocationError,
  LocationRequestOptions
} from "../NitroGeolocation.nitro";
import type { GeolocationResponse } from "../publicTypes";
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

export type BrowserPosition = {
  coords: BrowserCoordinates;
  timestamp: number;
};

export type BrowserPositionError = {
  code: number;
  message: string;
};

export type BrowserGeolocation = {
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

const defaultTimeoutMs = 600000;

export function getNavigator(): BrowserNavigator | undefined {
  const globalNavigator = (globalThis as { navigator?: BrowserNavigator })
    .navigator;
  return globalNavigator;
}

export function getGeolocation(): BrowserGeolocation | undefined {
  return getNavigator()?.geolocation;
}

export function toPositionOptions(
  options?: LocationRequestOptions
): BrowserPositionOptions {
  const androidAccuracy = options?.accuracy?.android;

  return {
    enableHighAccuracy:
      androidAccuracy !== undefined
        ? androidAccuracy === "high"
        : options?.enableHighAccuracy,
    timeout: options?.timeout ?? defaultTimeoutMs,
    maximumAge: options?.maximumAge ?? 0
  };
}

export function normalizePosition(
  position: BrowserPosition
): GeolocationResponse {
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

export function mapPermissionState(
  state: BrowserPermissionState
): "granted" | "denied" | "undetermined" {
  if (state === "granted") {
    return "granted";
  }
  if (state === "denied") {
    return "denied";
  }
  return "undetermined";
}

export function createUnsupportedError(): LocationError {
  return createLocationError(
    LocationErrorCode.POSITION_UNAVAILABLE,
    "Browser geolocation is unavailable. Use a secure context and a browser that supports navigator.geolocation."
  );
}

export function mapBrowserError(error: BrowserPositionError): LocationError {
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

export function rejectUnsupported<T>(): Promise<T> {
  return Promise.reject(createUnsupportedError());
}

export function distanceMeters(
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
