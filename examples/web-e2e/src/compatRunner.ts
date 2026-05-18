import Geolocation from "react-native-nitro-geolocation/compat";
import { setScenario } from "./dom";
import { postNativeStatus } from "./nativeBridge";
import { scenarios } from "./scenarios";

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

export function runCompatApiAvailabilityCheck() {
  setScenario("compat-api-availability", "running");
  const compatShape = {
    getCurrentPosition: typeof Geolocation.getCurrentPosition,
    watchPosition: typeof Geolocation.watchPosition,
    clearWatch: typeof Geolocation.clearWatch,
    stopObserving: typeof Geolocation.stopObserving,
    requestAuthorization: typeof Geolocation.requestAuthorization,
    setRNConfiguration: typeof Geolocation.setRNConfiguration
  };
  const compatReady = Object.values(compatShape).every(
    (type) => type === "function"
  );
  setScenario(
    "compat-api-availability",
    compatReady ? "pass" : "fail",
    compatShape
  );
  if (!compatReady) {
    throw new Error("Compat API browser export is incomplete.");
  }
}

export async function runCompatScenarios() {
  await runStep("compat-get-current-position", async () => {
    return new Promise<unknown>((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (compatPosition) => {
          if (
            typeof compatPosition?.coords?.latitude !== "number" ||
            typeof compatPosition?.coords?.longitude !== "number" ||
            typeof compatPosition?.timestamp !== "number"
          ) {
            reject(new Error("Compat position missing coords/timestamp."));
            return;
          }
          resolve(compatPosition);
        },
        (compatError) => {
          reject(compatError);
        },
        { maximumAge: 0, timeout: 15000 }
      );
    });
  });

  await runStep("compat-watch-position", async () => {
    return new Promise<unknown>((resolve, reject) => {
      let watchId = -1;
      let callbacksAfterClear = 0;
      let cleared = false;
      const timeout = window.setTimeout(() => {
        if (watchId !== -1) {
          Geolocation.clearWatch(watchId);
        }
        reject(new Error("Compat watch did not emit within 15s."));
      }, 15000);
      watchId = Geolocation.watchPosition(
        (compatPosition) => {
          if (cleared) {
            callbacksAfterClear += 1;
            return;
          }
          if (
            typeof compatPosition?.coords?.latitude !== "number" ||
            typeof compatPosition?.coords?.longitude !== "number" ||
            typeof compatPosition?.timestamp !== "number"
          ) {
            window.clearTimeout(timeout);
            Geolocation.clearWatch(watchId);
            reject(
              new Error("Compat watch position missing coords/timestamp.")
            );
            return;
          }
          cleared = true;
          Geolocation.clearWatch(watchId);
          window.setTimeout(() => {
            window.clearTimeout(timeout);
            if (callbacksAfterClear > 0) {
              reject(
                new Error(
                  `Compat watch fired ${callbacksAfterClear} time(s) after clearWatch.`
                )
              );
              return;
            }
            resolve({ watchId, sample: compatPosition });
          }, 1500);
        },
        (compatError) => {
          window.clearTimeout(timeout);
          if (watchId !== -1) {
            Geolocation.clearWatch(watchId);
          }
          reject(compatError);
        },
        { maximumAge: 0, timeout: 15000 }
      );
    });
  });

  await runStep("compat-stop-observing", async () => {
    return new Promise<unknown>((resolve, reject) => {
      let firstFired = false;
      let secondFired = false;
      let stopped = false;
      let callbacksAfterStop = 0;
      const ids: number[] = [];
      const timeout = window.setTimeout(() => {
        for (const id of ids) {
          Geolocation.clearWatch(id);
        }
        reject(new Error("Compat watches did not both emit within 15s."));
      }, 15000);
      const trySettle = () => {
        if (!firstFired || !secondFired || stopped) {
          return;
        }
        stopped = true;
        Geolocation.stopObserving();
        window.setTimeout(() => {
          window.clearTimeout(timeout);
          if (callbacksAfterStop > 0) {
            reject(
              new Error(
                `Compat watch fired ${callbacksAfterStop} time(s) after stopObserving.`
              )
            );
            return;
          }
          resolve({ ids, callbacksAfterStop });
        }, 1500);
      };
      ids.push(
        Geolocation.watchPosition(
          () => {
            if (stopped) {
              callbacksAfterStop += 1;
              return;
            }
            firstFired = true;
            trySettle();
          },
          (compatError) => {
            window.clearTimeout(timeout);
            for (const id of ids) {
              Geolocation.clearWatch(id);
            }
            reject(compatError);
          },
          { maximumAge: 0, timeout: 15000 }
        )
      );
      ids.push(
        Geolocation.watchPosition(
          () => {
            if (stopped) {
              callbacksAfterStop += 1;
              return;
            }
            secondFired = true;
            trySettle();
          },
          (compatError) => {
            window.clearTimeout(timeout);
            for (const id of ids) {
              Geolocation.clearWatch(id);
            }
            reject(compatError);
          },
          { maximumAge: 0, timeout: 15000 }
        )
      );
    });
  });
}

export async function runCompatSuite() {
  runCompatApiAvailabilityCheck();
  await runCompatScenarios();

  const failedScenarios = scenarios.filter(
    (scenario) =>
      [
        "compat-api-availability",
        "compat-get-current-position",
        "compat-watch-position",
        "compat-stop-observing"
      ].includes(scenario.id) && scenario.status !== "pass"
  );
  if (failedScenarios.length > 0) {
    throw new Error(
      `Compat suite incomplete: ${failedScenarios
        .map((scenario) => scenario.id)
        .join(", ")}`
    );
  }
  postNativeStatus("compat-suite", "pass");
}
