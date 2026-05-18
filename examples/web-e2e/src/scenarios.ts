export type ScenarioStatus = "idle" | "running" | "pass" | "fail" | "manual";

export type Scenario = {
  id: string;
  title: string;
  detail: string;
  status: ScenarioStatus;
  raw?: unknown;
};

export const scenarios: Scenario[] = [
  {
    id: "api-availability",
    title: "API availability",
    detail: "Root browser export exposes Modern API functions.",
    status: "idle"
  },
  {
    id: "compat-api-availability",
    title: "Compat API availability",
    detail: "Compat browser export resolves without native bindings.",
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
    id: "get-current-position",
    title: "getCurrentPosition",
    detail: "Returns coords and timestamp from navigator.geolocation.",
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
    id: "permission-denied",
    title: "permission denied -> PERMISSION_DENIED",
    detail: "Run with browser geolocation permission blocked.",
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
