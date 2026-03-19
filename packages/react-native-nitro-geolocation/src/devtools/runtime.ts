import type { LocationError } from "../NitroGeolocation.nitro";
import type { GeolocationResponse } from "../types";

interface DevtoolsRuntime {
  isEnabled: () => boolean;
  getCurrentPosition: () => Promise<GeolocationResponse> | null;
  watchPosition: (
    success: (position: GeolocationResponse) => void,
    error?: (error: LocationError) => void
  ) => string;
  unwatch: (token: string) => boolean;
}

declare global {
  var __geolocationDevtoolsRuntime: DevtoolsRuntime | undefined;
}

function getDevtoolsRuntime(): DevtoolsRuntime | null {
  if (!__DEV__) return null;

  const runtime = globalThis.__geolocationDevtoolsRuntime;
  if (!runtime || !runtime.isEnabled()) {
    return null;
  }

  return runtime;
}

export function getDevtoolsCurrentPositionIfEnabled(): Promise<GeolocationResponse> | null {
  const runtime = getDevtoolsRuntime();
  if (!runtime) return null;
  return runtime.getCurrentPosition();
}

export function watchDevtoolsPositionIfEnabled(
  success: (position: GeolocationResponse) => void,
  error?: (error: LocationError) => void
): string | null {
  const runtime = getDevtoolsRuntime();
  if (!runtime) return null;
  return runtime.watchPosition(success, error);
}

export function unwatchDevtoolsTokenIfEnabled(token: string): boolean {
  const runtime = getDevtoolsRuntime();
  if (!runtime) return false;
  return runtime.unwatch(token);
}
