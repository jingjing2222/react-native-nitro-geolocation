import type { GeolocationError, GeolocationResponse } from "../types";
import { getDevtoolsState } from "./index";

export function devtoolsWatchPosition(
  success: (position: GeolocationResponse) => void,
  error?: (error: GeolocationError) => void
): string {
  const devtools = getDevtoolsState();

  // Check if devtools has position at all
  if (!devtools.position) {
    // Call error callback immediately if provided
    if (error) {
      error({
        code: 2, // POSITION_UNAVAILABLE
        message:
          "Geolocation devtools not connected. Press 'j' in Metro to open devtools and enable the geolocation plugin.",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3
      });
    }
    // Return a dummy token that does nothing
    return `devtools-error-${Date.now()}`;
  }

  let previousPosition = devtools.position;

  // Send initial position immediately if available
  success(devtools.position);

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

  // Handle error tokens (no cleanup needed)
  if (token.startsWith("devtools-error-")) {
    return true;
  }

  const watchers = (globalThis as any).__devtoolsWatchers;
  if (watchers?.[token]) {
    clearInterval(watchers[token]);
    delete watchers[token];
    return true;
  }

  return false;
}
