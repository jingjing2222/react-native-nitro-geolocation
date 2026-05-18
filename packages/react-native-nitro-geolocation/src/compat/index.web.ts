import type {
  CompatGeolocationConfiguration,
  CompatGeolocationError,
  CompatGeolocationOptions,
  CompatGeolocationResponse
} from "../publicTypes";
import type { BrowserPosition, BrowserPositionError } from "../web/browser";
import { getGeolocation } from "../web/browser";

export type {
  CompatGeolocationConfiguration as GeolocationConfiguration,
  CompatGeolocationResponse as GeolocationResponse,
  CompatGeolocationError as GeolocationError,
  CompatGeolocationOptions as GeolocationOptions
} from "../publicTypes";

function mapPosition(pos: BrowserPosition): CompatGeolocationResponse {
  return {
    coords: {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      altitude: pos.coords.altitude,
      accuracy: pos.coords.accuracy,
      altitudeAccuracy: pos.coords.altitudeAccuracy,
      heading: pos.coords.heading,
      speed: pos.coords.speed
    },
    timestamp: pos.timestamp
  };
}

function mapError(err: BrowserPositionError): CompatGeolocationError {
  return {
    code: err.code,
    message: err.message,
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3
  };
}

export function setRNConfiguration(
  _config: CompatGeolocationConfiguration
): void {}

export function requestAuthorization(
  success?: () => void,
  _error?: (error: CompatGeolocationError) => void
): void {
  success?.();
}

export function getCurrentPosition(
  success: (position: CompatGeolocationResponse) => void,
  error?: (error: CompatGeolocationError) => void,
  options?: CompatGeolocationOptions
): void {
  const geo = getGeolocation();
  if (!geo) {
    error?.({
      code: 2,
      message: "Browser geolocation is unavailable.",
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3
    });
    return;
  }
  geo.getCurrentPosition(
    (pos) => success(mapPosition(pos)),
    error ? (err) => error(mapError(err)) : undefined,
    options
      ? {
          timeout: options.timeout,
          maximumAge: options.maximumAge,
          enableHighAccuracy: options.enableHighAccuracy
        }
      : undefined
  );
}

export function watchPosition(
  success: (position: CompatGeolocationResponse) => void,
  error?: (error: CompatGeolocationError) => void,
  options?: CompatGeolocationOptions
): number {
  const geo = getGeolocation();
  if (!geo) {
    error?.({
      code: 2,
      message: "Browser geolocation is unavailable.",
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3
    });
    return -1;
  }
  return geo.watchPosition(
    (pos) => success(mapPosition(pos)),
    error ? (err) => error(mapError(err)) : undefined,
    options
      ? {
          timeout: options.timeout,
          maximumAge: options.maximumAge,
          enableHighAccuracy: options.enableHighAccuracy
        }
      : undefined
  );
}

export function clearWatch(watchId: number): void {
  getGeolocation()?.clearWatch(watchId);
}

export function stopObserving(): void {}

const Geolocation = {
  setRNConfiguration,
  requestAuthorization,
  getCurrentPosition,
  watchPosition,
  clearWatch,
  stopObserving
};

export default Geolocation;
