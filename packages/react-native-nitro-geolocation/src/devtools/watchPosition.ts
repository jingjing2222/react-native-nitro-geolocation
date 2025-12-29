import type {
  LocationError,
  LocationRequestOptions
} from "../NitroGeolocation.nitro";
import type { GeolocationResponse } from "../types";
import { getDevtoolsState } from "./index";

export function devtoolsWatchPosition(
  success: (position: GeolocationResponse) => void,
  error?: (error: LocationError) => void,
  options?: LocationRequestOptions
): string {
  const devtools = getDevtoolsState();
  let previousPosition = devtools.position;

  // Send initial position immediately if available
  if (devtools.position) {
    success(devtools.position);
  }

  const interval = setInterval(() => {
    if (devtools.position && devtools.position !== previousPosition) {
      previousPosition = devtools.position;
      success(devtools.position);
    }
  }, 100);

  // Return a cleanup token
  const token = `devtools-${Date.now()}`;
  (globalThis as any).__devtoolsWatchers =
    (globalThis as any).__devtoolsWatchers || {};
  (globalThis as any).__devtoolsWatchers[token] = interval;

  return token;
}

export function devtoolsUnwatch(token: string): boolean {
  if (!token.startsWith("devtools-")) {
    return false;
  }

  const watchers = (globalThis as any).__devtoolsWatchers;
  if (watchers?.[token]) {
    clearInterval(watchers[token]);
    delete watchers[token];
    return true;
  }

  return false;
}
