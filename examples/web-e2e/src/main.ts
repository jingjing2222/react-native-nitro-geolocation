import {
  checkPermission,
  getCurrentPosition,
  requestPermission,
  stopObserving,
  unwatch,
  watchPosition
} from "react-native-nitro-geolocation";
import type {
  GeolocationResponse,
  LocationError,
  PermissionStatus
} from "react-native-nitro-geolocation";
import "./styles.css";

type ScenarioStatus = "idle" | "running" | "pass" | "fail" | "manual";

type Scenario = {
  id: string;
  title: string;
  detail: string;
  status: ScenarioStatus;
  raw?: unknown;
};

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage(message: string): void;
    };
  }
}

const scenarios: Scenario[] = [
  {
    id: "api-availability",
    title: "API availability",
    detail: "Root browser export exposes Modern API functions.",
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

const grid = document.querySelector<HTMLDivElement>("#scenario-grid");
const successButton = document.querySelector<HTMLButtonElement>("#run-success");
const deniedButton = document.querySelector<HTMLButtonElement>("#run-denied");
const unavailableButton =
  document.querySelector<HTMLButtonElement>("#run-unavailable");
const timeoutButton = document.querySelector<HTMLButtonElement>("#run-timeout");
const clearButton = document.querySelector<HTMLButtonElement>("#clear-results");

function render() {
  if (!grid) {
    return;
  }

  grid.innerHTML = scenarios
    .map(
      (scenario) => `
        <article class="scenario ${scenario.status}" data-testid="${scenario.id}">
          <div>
            <span class="badge">${scenario.status.toUpperCase()}</span>
            <h2>${scenario.title}</h2>
            <p>${scenario.detail}</p>
          </div>
          <pre>${escapeHtml(JSON.stringify(scenario.raw ?? null, null, 2))}</pre>
        </article>
      `
    )
    .join("");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function setScenario(
  id: string,
  status: ScenarioStatus,
  raw?: unknown,
  detail?: string
) {
  const scenario = scenarios.find((item) => item.id === id);
  if (!scenario) {
    return;
  }

  scenario.status = status;
  scenario.raw = raw;
  if (detail) {
    scenario.detail = detail;
  }
  render();
  window.ReactNativeWebView?.postMessage(
    JSON.stringify({
      id,
      status,
      detail: scenario.detail,
      raw
    })
  );
  if (status !== "idle") {
    document
      .querySelector(`[data-testid="${id}"]`)
      ?.scrollIntoView({ block: "center", behavior: "auto" });
  }
}

function assertPosition(position: GeolocationResponse) {
  if (
    typeof position.coords.latitude !== "number" ||
    typeof position.coords.longitude !== "number" ||
    typeof position.coords.accuracy !== "number" ||
    typeof position.timestamp !== "number"
  ) {
    throw new Error("Position missing numeric coords/timestamp.");
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorCode(error: unknown): number | undefined {
  return (error as Partial<LocationError>).code;
}

async function runStep<T>(
  id: string,
  action: () => Promise<T>,
  validate: (value: T) => void = () => undefined
) {
  setScenario(id, "running");
  try {
    const result = await action();
    validate(result);
    setScenario(id, "pass", result);
    return result;
  } catch (error) {
    setScenario(id, "fail", error);
    throw error;
  }
}

async function runSuccessSuite() {
  setScenario("api-availability", "running");
  const apiShape = {
    checkPermission: typeof checkPermission,
    requestPermission: typeof requestPermission,
    getCurrentPosition: typeof getCurrentPosition,
    watchPosition: typeof watchPosition,
    unwatch: typeof unwatch,
    stopObserving: typeof stopObserving
  };
  const apiReady = Object.values(apiShape).every((type) => type === "function");
  setScenario("api-availability", apiReady ? "pass" : "fail", apiShape);
  if (!apiReady) {
    throw new Error("Modern API browser export is incomplete.");
  }

  await runStep<PermissionStatus>(
    "check-permission",
    () => checkPermission(),
    (status) => {
      if (
        !["granted", "denied", "restricted", "undetermined"].includes(status)
      ) {
        throw new Error(`Unexpected permission status: ${status}`);
      }
    }
  );

  await runStep<PermissionStatus>(
    "request-permission",
    () => requestPermission(),
    (status) => {
      if (status !== "granted") {
        throw new Error(`Expected granted permission, got ${status}.`);
      }
    }
  );

  await runStep(
    "watch-position",
    () =>
      new Promise<GeolocationResponse>((resolve, reject) => {
        const token = watchPosition(
          (nextPosition) => {
            unwatch(token);
            resolve(nextPosition);
          },
          reject,
          { maximumAge: 0, timeout: 15000 }
        );
      }),
    assertPosition
  );

  const position = await runStep(
    "get-current-position",
    () => getCurrentPosition({ maximumAge: 0, timeout: 15000 }),
    assertPosition
  );

  await runStep(
    "unwatch",
    async () => {
      const events: GeolocationResponse[] = [];
      let token = "";
      const firstEvent = new Promise<GeolocationResponse>((resolve, reject) => {
        token = watchPosition(
          (nextPosition) => {
            events.push(nextPosition);
            resolve(nextPosition);
          },
          reject,
          { maximumAge: 0, timeout: 15000 }
        );
      });
      await firstEvent;
      unwatch(token);
      const callbackCountAfterUnwatch = events.length;
      setScenario(
        "unwatch",
        "running",
        { phase: "move-after-unwatch", token, callbackCountAfterUnwatch },
        "Watcher emitted once and token was cleared. Move device location now; no extra callback should arrive."
      );
      await wait(5000);
      return {
        token,
        callbackCountAfterUnwatch,
        callbackCount: events.length
      };
    },
    (result) => {
      if (result.callbackCountAfterUnwatch < 1) {
        throw new Error("Expected unwatch scenario to prove an active watch.");
      }
      if (result.callbackCount !== result.callbackCountAfterUnwatch) {
        throw new Error(
          `Expected unwatch to prevent callbacks, got ${result.callbackCount}.`
        );
      }
    }
  );

  await runStep(
    "stop-observing",
    async () => {
      const firstEvents: GeolocationResponse[] = [];
      const secondEvents: GeolocationResponse[] = [];
      let firstToken = "";
      let secondToken = "";
      const firstReady = new Promise<GeolocationResponse>((resolve, reject) => {
        firstToken = watchPosition(
          (nextPosition) => {
            firstEvents.push(nextPosition);
            resolve(nextPosition);
          },
          reject,
          { maximumAge: 0, timeout: 15000 }
        );
      });
      const secondReady = new Promise<GeolocationResponse>(
        (resolve, reject) => {
          secondToken = watchPosition(
            (nextPosition) => {
              secondEvents.push(nextPosition);
              resolve(nextPosition);
            },
            reject,
            { maximumAge: 0, timeout: 15000 }
          );
        }
      );
      await Promise.all([firstReady, secondReady]);
      stopObserving();
      const callbackCountAfterStop = firstEvents.length + secondEvents.length;
      setScenario(
        "stop-observing",
        "running",
        {
          phase: "move-after-stop-observing",
          firstToken,
          secondToken,
          callbackCountAfterStop
        },
        "Both watches emitted once and stopObserving cleared them. Move device location now; no extra callback should arrive."
      );
      await wait(5000);
      return {
        firstToken,
        secondToken,
        callbackCountAfterStop,
        callbackCount: firstEvents.length + secondEvents.length,
        baseline: position
      };
    },
    (result) => {
      if (result.callbackCountAfterStop < 2) {
        throw new Error(
          "Expected stopObserving scenario to prove active watches."
        );
      }
      if (result.callbackCount !== result.callbackCountAfterStop) {
        throw new Error(
          `Expected stopObserving to prevent callbacks, got ${result.callbackCount}.`
        );
      }
    }
  );

  const failedScenarios = scenarios.filter(
    (scenario) =>
      [
        "api-availability",
        "check-permission",
        "request-permission",
        "get-current-position",
        "watch-position",
        "unwatch",
        "stop-observing"
      ].includes(scenario.id) && scenario.status !== "pass"
  );
  if (failedScenarios.length > 0) {
    throw new Error(
      `Success suite incomplete: ${failedScenarios
        .map((scenario) => scenario.id)
        .join(", ")}`
    );
  }
}

async function runDeniedCheck() {
  setScenario("permission-denied", "running");
  try {
    await getCurrentPosition({ maximumAge: 0, timeout: 5000 });
    setScenario(
      "permission-denied",
      "fail",
      { code: "resolved" },
      "Expected browser permission to be blocked, but request resolved."
    );
  } catch (error) {
    const code = getErrorCode(error);
    setScenario(
      "permission-denied",
      code === 1 ? "pass" : "fail",
      error,
      code === 1
        ? "Browser returned PERMISSION_DENIED."
        : `Expected PERMISSION_DENIED code 1, got ${String(code)}.`
    );
  }
}

async function runUnavailableCheck() {
  setScenario("position-unavailable", "running");
  try {
    const positionResult = await getCurrentPosition({
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000
    });
    setScenario(
      "position-unavailable",
      "fail",
      positionResult,
      "Expected provider/location services to be unavailable, but browser returned a position."
    );
  } catch (error) {
    const code = getErrorCode(error);
    const status = code === 2 ? "pass" : code === 3 ? "manual" : "fail";
    setScenario(
      "position-unavailable",
      status,
      error,
      code === 2
        ? "Browser returned POSITION_UNAVAILABLE."
        : code === 3
          ? "Browser returned TIMEOUT while provider/location services were disabled. Platform does not expose provider-disabled state."
          : `Expected POSITION_UNAVAILABLE or platform TIMEOUT, got ${String(code)}.`
    );
  }
}

async function runTimeoutCheck() {
  setScenario("timeout", "running");
  try {
    await getCurrentPosition({
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 1
    });
    setScenario(
      "timeout",
      "manual",
      { code: "resolved" },
      "Browser returned cached/fresh location before strict timeout."
    );
  } catch (error) {
    const code = getErrorCode(error);
    setScenario(
      "timeout",
      code === 3 ? "pass" : "manual",
      error,
      code === 3
        ? "Browser returned TIMEOUT."
        : `Got ${String(code)}. Timeout is browser/provider timing dependent.`
    );
  }
}

successButton?.addEventListener("click", () => {
  void runSuccessSuite();
});
deniedButton?.addEventListener("click", () => {
  void runDeniedCheck();
});
unavailableButton?.addEventListener("click", () => {
  void runUnavailableCheck();
});
timeoutButton?.addEventListener("click", () => {
  void runTimeoutCheck();
});
clearButton?.addEventListener("click", () => {
  for (const scenario of scenarios) {
    scenario.status =
      scenario.id === "position-unavailable" || scenario.id === "timeout"
        ? "manual"
        : "idle";
    scenario.raw = undefined;
  }
  render();
});

render();

const params = new URLSearchParams(location.search);
if (params.get("autorun") === "success") {
  void runSuccessSuite();
} else if (params.get("autorun") === "denied") {
  void runDeniedCheck();
} else if (params.get("autorun") === "unavailable") {
  void runUnavailableCheck();
} else if (params.get("autorun") === "timeout") {
  void runTimeoutCheck();
}
