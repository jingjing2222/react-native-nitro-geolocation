import type {
  ActiveWatch,
  GeolocationResponse,
  LocationRequestOptions
} from "../publicTypes";
import type { LocationError } from "../utils/errors";
import { LocationErrorCodes } from "../utils/errors";
import { getDevtoolsState } from "./index";

type DevtoolsWatchRegistration = {
  previousObservedPosition: GeolocationResponse;
  previousDeliveredPosition: GeolocationResponse;
  lastDeliveredAt: number;
  deliveredUpdates: number;
  distanceFilter: number;
  minimumInterval: number;
  maxUpdates?: number;
  success: (position: GeolocationResponse) => void;
};

type DevtoolsWatchPlatform = "android" | "ios";

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

function distanceMeters(
  first: GeolocationResponse,
  second: GeolocationResponse
): number {
  const earthRadiusMeters = 6_371_000;
  const firstLatitude = (first.coords.latitude * Math.PI) / 180;
  const secondLatitude = (second.coords.latitude * Math.PI) / 180;
  const latitudeDelta =
    ((second.coords.latitude - first.coords.latitude) * Math.PI) / 180;
  const longitudeDelta =
    ((second.coords.longitude - first.coords.longitude) * Math.PI) / 180;
  const latitudeSine = Math.sin(latitudeDelta / 2);
  const longitudeSine = Math.sin(longitudeDelta / 2);
  const haversine =
    latitudeSine * latitudeSine +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      longitudeSine *
      longitudeSine;

  return (
    2 *
    earthRadiusMeters *
    Math.asin(Math.sqrt(Math.min(Math.max(haversine, 0), 1)))
  );
}

function getAndroidMaxUpdates(
  options: LocationRequestOptions | undefined,
  platform: DevtoolsWatchPlatform
): number | undefined {
  if (platform !== "android" || options?.maxUpdates === undefined) {
    return undefined;
  }
  return Math.trunc(options.maxUpdates);
}

function shouldDeliverPosition(
  registration: DevtoolsWatchRegistration,
  position: GeolocationResponse,
  observedAt: number
): boolean {
  const intervalSatisfied =
    observedAt - registration.lastDeliveredAt >= registration.minimumInterval;
  const distanceSatisfied =
    registration.distanceFilter <= 0 ||
    distanceMeters(registration.previousDeliveredPosition, position) >=
      registration.distanceFilter;
  return intervalSatisfied && distanceSatisfied;
}

function pollDevtoolsPosition(): void {
  const position = getDevtoolsState().position;
  if (!position) return;

  const watchers = getDevtoolsWatchers();
  const observedAt = Date.now();
  for (const [token, registration] of watchers) {
    if (position === registration.previousObservedPosition) continue;
    registration.previousObservedPosition = position;
    if (!shouldDeliverPosition(registration, position, observedAt)) continue;

    registration.previousDeliveredPosition = position;
    registration.lastDeliveredAt = observedAt;
    registration.deliveredUpdates += 1;
    registration.success(position);
    if (
      registration.maxUpdates !== undefined &&
      registration.deliveredUpdates >= registration.maxUpdates
    ) {
      watchers.delete(token);
    }
  }
  if (watchers.size === 0) stopDevtoolsPolling();
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
  error?: (error: LocationError) => void,
  options?: LocationRequestOptions,
  platform: DevtoolsWatchPlatform = "ios"
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

  const token = `devtools-${nextDevtoolsWatchSequence()}`;
  const observedAt = Date.now();
  const maxUpdates = getAndroidMaxUpdates(options, platform);
  getDevtoolsWatchers().set(token, {
    previousObservedPosition: devtools.position,
    previousDeliveredPosition: devtools.position,
    lastDeliveredAt: observedAt,
    deliveredUpdates: 1,
    distanceFilter: options?.distanceFilter ?? 0,
    minimumInterval: platform === "android" ? (options?.interval ?? 1_000) : 0,
    maxUpdates,
    success
  });

  // Send initial position immediately, matching native watch behavior.
  success(devtools.position);

  if (maxUpdates !== undefined && maxUpdates <= 1) {
    getDevtoolsWatchers().delete(token);
  } else {
    startDevtoolsPolling();
  }

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
  if (watchers instanceof Map) {
    watchers.delete(token);
    if (watchers.size === 0) stopDevtoolsPolling();
  }

  // DevTools tokens are owned here even after automatic or repeated cleanup.
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
