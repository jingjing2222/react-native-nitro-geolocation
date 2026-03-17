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

function loadDevtoolsRuntime(): DevtoolsRuntime | null {
  if (!__DEV__) return null;

  const devtools = require("../devtools") as typeof import("../devtools");
  if (!devtools.isDevtoolsEnabled()) {
    return null;
  }

  const { getDevtoolsCurrentPosition } = require("../devtools/getCurrentPosition") as typeof import("../devtools/getCurrentPosition");
  const { devtoolsWatchPosition, devtoolsUnwatch } = require("../devtools/watchPosition") as typeof import("../devtools/watchPosition");

  return {
    isEnabled: devtools.isDevtoolsEnabled,
    getCurrentPosition: getDevtoolsCurrentPosition,
    watchPosition: devtoolsWatchPosition,
    unwatch: devtoolsUnwatch
  };
}

export function getDevtoolsCurrentPositionIfEnabled(): Promise<GeolocationResponse> | null {
  const runtime = loadDevtoolsRuntime();
  if (!runtime) return null;
  return runtime.getCurrentPosition();
}

export function watchDevtoolsPositionIfEnabled(
  success: (position: GeolocationResponse) => void,
  error?: (error: LocationError) => void
): string | null {
  const runtime = loadDevtoolsRuntime();
  if (!runtime) return null;
  return runtime.watchPosition(success, error);
}

export function unwatchDevtoolsTokenIfEnabled(token: string): boolean {
  const runtime = loadDevtoolsRuntime();
  if (!runtime) return false;
  return runtime.unwatch(token);
}
