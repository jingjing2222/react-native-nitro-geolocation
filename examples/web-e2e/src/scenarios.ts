export type ScenarioStatus = "idle" | "running" | "pass" | "fail" | "manual";

export type Scenario = {
  id: string;
  title: string;
  detail: string;
  status: ScenarioStatus;
  raw?: unknown;
};

export const successScenarioIds = new Set([
  "api-availability",
  "compat-api-availability",
  "request-location-settings",
  "check-permission",
  "request-permission",
  "permission-details-after-request",
  "get-current-position-pre-aborted",
  "get-current-position-cancelled",
  "get-current-position",
  "location-readiness",
  "last-known-cold-cache",
  "last-known-async-cold-cache",
  "last-known-module-cache",
  "last-known-async-cache",
  "last-known-stale-cache",
  "watch-position",
  "unwatch",
  "stop-observing",
  "compat-get-current-position",
  "compat-metadata-get-current-position",
  "compat-watch-position",
  "compat-stop-observing",
  "compat-metadata-watch-position"
]);

export const scenarios: Scenario[] = [
  {
    id: "api-availability",
    title: "API availability",
    detail: "The browser export exposes the API functions.",
    status: "idle"
  },
  {
    id: "compat-api-availability",
    title: "Compat API availability",
    detail: "Compat browser export resolves without native bindings.",
    status: "idle"
  },
  {
    id: "request-location-settings",
    title: "requestLocationSettings result",
    detail: "Returns a deterministic outcome and current provider status.",
    status: "idle"
  },
  {
    id: "check-permission",
    title: "checkPermission",
    detail: "Reads browser permission state when Permissions API exists.",
    status: "idle"
  },
  {
    id: "request-permission",
    title: "requestPermission",
    detail: "Triggers browser prompt with one-shot geolocation call.",
    status: "idle"
  },
  {
    id: "permission-details-after-request",
    title: "getPermissionDetails after request",
    detail:
      "Reads a recent granted browser observation without prompting again.",
    status: "idle"
  },
  {
    id: "get-current-position",
    title: "getCurrentPosition",
    detail: "Returns coords and timestamp from navigator.geolocation.",
    status: "idle"
  },
  {
    id: "location-readiness",
    title: "getLocationReadiness",
    detail:
      "Combines permission, service, availability, and observed cache state without prompting.",
    status: "idle"
  },
  {
    id: "get-current-position-pre-aborted",
    title: "getCurrentPosition pre-aborted",
    detail: "Rejects with the exact abort reason without starting a request.",
    status: "idle"
  },
  {
    id: "get-current-position-cancelled",
    title: "getCurrentPosition in-flight cancellation",
    detail: "Cancels an active one-shot request with AbortSignal.",
    status: "idle"
  },
  {
    id: "last-known-cold-cache",
    title: "getLastKnownPosition cold cache",
    detail: "Sync read returns undefined before any position is observed.",
    status: "idle"
  },
  {
    id: "last-known-async-cold-cache",
    title: "getLastKnownPositionAsync cold cache",
    detail:
      "Async read returns undefined without prompting or querying browser geolocation.",
    status: "idle"
  },
  {
    id: "last-known-module-cache",
    title: "getLastKnownPosition module cache",
    detail:
      "Sync read returns the latest observed position without a platform query.",
    status: "idle"
  },
  {
    id: "last-known-async-cache",
    title: "getLastKnownPositionAsync module cache",
    detail: "Async read applies cache filters without a browser query.",
    status: "idle"
  },
  {
    id: "last-known-stale-cache",
    title: "getLastKnownPositionAsync stale cache",
    detail: "maximumAge=0 returns undefined without a browser query.",
    status: "idle"
  },
  {
    id: "watch-position",
    title: "watchPosition emits update",
    detail: "Starts real browser watch and receives normalized coords.",
    status: "idle"
  },
  {
    id: "unwatch",
    title: "unwatch stops watcher",
    detail: "Clears single watch token without later callback.",
    status: "idle"
  },
  {
    id: "stop-observing",
    title: "stopObserving clears watchers",
    detail: "Clears all active web watch tokens.",
    status: "idle"
  },
  {
    id: "compat-get-current-position",
    title: "compat getCurrentPosition",
    detail: "Compat callback receives normalized coords from real browser.",
    status: "idle"
  },
  {
    id: "compat-metadata-get-current-position",
    title: "compat getCurrentPosition metadata opt-in",
    detail: "Opt-in browser response exposes provider without mocked state.",
    status: "idle"
  },
  {
    id: "compat-watch-position",
    title: "compat watchPosition + clearWatch",
    detail: "Compat watch emits coords, clearWatch stops subsequent callbacks.",
    status: "idle"
  },
  {
    id: "compat-stop-observing",
    title: "compat stopObserving clears all watches",
    detail: "stopObserving clears every active compat watch.",
    status: "idle"
  },
  {
    id: "compat-metadata-watch-position",
    title: "compat watchPosition metadata opt-in",
    detail:
      "Opt-in browser watch keeps provider metadata for its subscription.",
    status: "idle"
  },
  {
    id: "permission-denied",
    title: "permission denied -> PERMISSION_DENIED",
    detail: "Run with browser geolocation permission blocked.",
    status: "idle"
  },
  {
    id: "permission-details-after-denial",
    title: "getPermissionDetails after denial",
    detail:
      "Uses browser permission evidence without overclaiming prompt behavior.",
    status: "idle"
  },
  {
    id: "location-readiness-after-denial",
    title: "getLocationReadiness after denial",
    detail:
      "Uses bounded denial evidence when browser permission state is unavailable.",
    status: "idle"
  },
  {
    id: "position-unavailable",
    title: "provider unavailable -> POSITION_UNAVAILABLE",
    detail: "Run with permission granted but no browser provider/location.",
    status: "manual"
  },
  {
    id: "timeout",
    title: "strict timeout -> TIMEOUT",
    detail: "Manual/non-blocking because browsers may return cached location.",
    status: "manual"
  }
];
