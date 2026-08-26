import type { GeolocationResponse } from "../publicTypes";
import type { ActiveWatch } from "../publicTypes";
import type { LocationError } from "../utils/errors";
import { LocationErrorCodes } from "../utils/errors";
import { getDevtoolsState } from "./index";

type DevtoolsWatchRegistration = {
  previousPosition: GeolocationResponse;
  success: (position: GeolocationResponse) => void;
};

type DevtoolsWatchGlobals = typeof globalThis & {
  __devtoolsWatchInterval?: ReturnType<typeof setInterval>;
  __devtoolsWatchers?: Map<string, DevtoolsWatchRegistration>;
  __devtoolsWatchSequence?: number;
};

function getDevtoolsGlobals(): DevtoolsWatchGlobals {
  return globalThis as DevtoolsWatchGlobals;
}

function nextDevtoolsWatchSequence(): number {
  const globals = getDevtoolsGlobals();
  globals.__devtoolsWatchSequence = (globals.__devtoolsWatchSequence ?? 0) + 1;
  return globals.__devtoolsWatchSequence;
}

function getDevtoolsWatchers(): Map<string, DevtoolsWatchRegistration> {
  const globals = getDevtoolsGlobals();
  if (!(globals.__devtoolsWatchers instanceof Map)) {
    globals.__devtoolsWatchers = new Map();
  }
  return globals.__devtoolsWatchers;
}

function pollDevtoolsPosition(): void {
  const position = getDevtoolsState().position;
  if (!position) return;

  for (const registration of getDevtoolsWatchers().values()) {
    if (position === registration.previousPosition) continue;
    registration.previousPosition = position;
    registration.success(position);
  }
}

function startDevtoolsPolling(): void {
  const globals = getDevtoolsGlobals();
  if (globals.__devtoolsWatchInterval !== undefined) return;
  globals.__devtoolsWatchInterval = setInterval(pollDevtoolsPosition, 100);
}

function stopDevtoolsPolling(): void {
  const globals = getDevtoolsGlobals();
  if (globals.__devtoolsWatchInterval === undefined) return;
  clearInterval(globals.__devtoolsWatchInterval);
  globals.__devtoolsWatchInterval = undefined;
}

export function devtoolsWatchPosition(
  success: (position: GeolocationResponse) => void,
  error?: (error: LocationError) => void
): string {
  const devtools = getDevtoolsState();

  // Check if devtools has position at all
  if (!devtools.position) {
    // Call error callback immediately if provided
    if (error) {
      error({
        code: LocationErrorCodes.POSITION_UNAVAILABLE,
        message:
          "Geolocation devtools not connected. Press 'j' in Metro to open devtools and enable the geolocation plugin."
      });
    }
    // Return a dummy token that does nothing
    return `devtools-error-${nextDevtoolsWatchSequence()}`;
  }

  // Send initial position immediately if available
  success(devtools.position);

  const token = `devtools-${nextDevtoolsWatchSequence()}`;
  getDevtoolsWatchers().set(token, {
    previousPosition: devtools.position,
    success
  });
  startDevtoolsPolling();

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

  const watchers = getDevtoolsGlobals().__devtoolsWatchers;
  if (!(watchers instanceof Map) || !watchers.delete(token)) return false;
  if (watchers.size === 0) stopDevtoolsPolling();

  return true;
}

export function getDevtoolsActiveWatches(): ActiveWatch[] {
  const watchers = getDevtoolsGlobals().__devtoolsWatchers;
  if (!(watchers instanceof Map)) return [];
  return Array.from(watchers.keys(), (token) => ({
    token,
    kind: "position"
  }));
}

export function devtoolsStopObserving(): void {
  const watchers = getDevtoolsGlobals().__devtoolsWatchers;
  if (watchers instanceof Map) watchers.clear();
  stopDevtoolsPolling();
}
