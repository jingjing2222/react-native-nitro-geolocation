import React from "react";
import {
  getCurrentPosition,
  getLastKnownPositionAsync,
  unwatch,
  watchPosition
} from "react-native-nitro-geolocation";
import type { GeolocationResponse } from "react-native-nitro-geolocation";
import {
  PermissionStatusBlock,
  ResultBlock,
  ScenarioButton,
  ScenarioScreen,
  ScenarioSection,
  assertFixtureCoordinates,
  createScenarioResults,
  getDisplayErrorMessage,
  runWithNativeGeolocation,
  usePermissionStatus,
  useScenarioResults
} from "./scenario";

const PREFIX = "cancellable-current-position";
const CONCURRENCY_FIXTURE = {
  latitude: 37.6123,
  longitude: 127.0456
};
const COORDINATE_TOLERANCE = 0.0001;

const initialResults = createScenarioResults([
  "preAborted",
  "cacheIsolation",
  "isolation",
  "watchIsolation"
] as const);

function isConcurrencyFixture(position: GeolocationResponse) {
  return (
    Math.abs(position.coords.latitude - CONCURRENCY_FIXTURE.latitude) <=
      COORDINATE_TOLERANCE &&
    Math.abs(position.coords.longitude - CONCURRENCY_FIXTURE.longitude) <=
      COORDINATE_TOLERANCE
  );
}

function formatCoordinates(position: GeolocationResponse) {
  return `${position.coords.latitude.toFixed(
    6
  )}, ${position.coords.longitude.toFixed(6)}`;
}

function abortWithReason(controller: AbortController, reason: unknown) {
  (controller.abort as (reason?: unknown) => void)(reason);
}

function assertAbortOutcome(
  error: unknown,
  signal: AbortSignal,
  requestedReason: unknown
): "exact reason" | "AbortError fallback" {
  const runtimeReason = (signal as AbortSignal & { reason?: unknown }).reason;
  if (runtimeReason !== undefined) {
    if (error !== runtimeReason || runtimeReason !== requestedReason) {
      throw new Error("Cancelled request did not preserve signal.reason.");
    }
    return "exact reason";
  }

  if (!(error instanceof Error) || error.name !== "AbortError") {
    throw new Error("Cancelled request did not use an AbortError fallback.");
  }
  return "AbortError fallback";
}

export default function CancellableCurrentPositionScreen() {
  const { permissionStatus, refreshPermission, requestLocationPermission } =
    usePermissionStatus();
  const { results, setResult } = useScenarioResults(initialResults);

  const runPreAbortedScenario = async () => {
    setResult("preAborted", {
      status: "running",
      message: "Rejecting a request whose signal is already aborted"
    });

    const controller = new AbortController();
    const reason = new Error("cancelled before native work");
    abortWithReason(controller, reason);

    try {
      await runWithNativeGeolocation(() =>
        getCurrentPosition({ signal: controller.signal })
      );
      throw new Error("Pre-aborted getCurrentPosition unexpectedly resolved.");
    } catch (error) {
      try {
        const outcome = assertAbortOutcome(error, controller.signal, reason);
        setResult("preAborted", {
          status: "passed",
          message: `Pre-aborted request preserved the ${outcome}.`
        });
      } catch (assertionError) {
        setResult("preAborted", {
          status: "failed",
          message: getDisplayErrorMessage(assertionError)
        });
      }
    } finally {
      await refreshPermission();
    }
  };

  const runIsolationScenario = async () => {
    setResult("isolation", {
      status: "running",
      message: "Starting two native requests and cancelling the first"
    });

    const cancelledController = new AbortController();
    const survivorController = new AbortController();
    const cancellationReason = new Error("cancel only the first request");

    try {
      const permission = await requestLocationPermission();
      if (permission !== "granted") {
        throw new Error(`Permission was not granted: ${permission}`);
      }

      const survivor = await runWithNativeGeolocation(async () => {
        const requestOptions = {
          accuracy: { android: "high" as const, ios: "best" as const },
          maximumAge: 0,
          timeout: 30000
        };
        const cancelledRequest = getCurrentPosition({
          ...requestOptions,
          signal: cancelledController.signal
        });
        const survivingRequest = getCurrentPosition({
          ...requestOptions,
          signal: survivorController.signal
        });

        abortWithReason(cancelledController, cancellationReason);

        try {
          await cancelledRequest;
          throw new Error("Cancelled request unexpectedly resolved.");
        } catch (error) {
          assertAbortOutcome(
            error,
            cancelledController.signal,
            cancellationReason
          );
        }

        setResult("isolation", {
          status: "running",
          message:
            "Cancelled request rejected; move location for surviving request."
        });
        return survivingRequest;
      });

      const coordinates = assertFixtureCoordinates(survivor);
      setResult("isolation", {
        status: "passed",
        message: `Native cancellation cancelled first only; survivor ${coordinates}.`
      });
    } catch (error) {
      setResult("isolation", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      survivorController.abort();
      await refreshPermission();
    }
  };

  const runCacheIsolationScenario = async () => {
    setResult("cacheIsolation", {
      status: "running",
      message: "Starting a watch and an immediate cache read"
    });

    try {
      const watchedPosition = await runWithNativeGeolocation(
        () =>
          new Promise<GeolocationResponse>((resolve, reject) => {
            let token = "";
            let didFinish = false;
            let cacheReadFinished = false;
            const timeout = setTimeout(() => {
              finish(() =>
                reject(
                  new Error(
                    "Watch did not deliver after the concurrent cache read."
                  )
                )
              );
            }, 30000);
            const finish = (callback: () => void) => {
              if (didFinish) return;
              didFinish = true;
              clearTimeout(timeout);
              if (token) unwatch(token);
              callback();
            };

            token = watchPosition(
              (position) => {
                if (!cacheReadFinished || !isConcurrencyFixture(position)) {
                  return;
                }
                finish(() => resolve(position));
              },
              (error) => finish(() => reject(error)),
              {
                accuracy: { android: "high", ios: "best" },
                maximumAge: 0,
                timeout: 30000
              }
            );

            getLastKnownPositionAsync({ maximumAge: 0 }).then(
              () => {
                cacheReadFinished = true;
                setResult("cacheIsolation", {
                  status: "running",
                  message:
                    "Cache read completed; move location for the active watch."
                });
              },
              (error) => finish(() => reject(error))
            );
          })
      );

      setResult("cacheIsolation", {
        status: "passed",
        message: `Cache read kept watch active at ${formatCoordinates(
          watchedPosition
        )}.`
      });
    } catch (error) {
      setResult("cacheIsolation", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      await refreshPermission();
    }
  };

  const runWatchIsolationScenario = async () => {
    setResult("watchIsolation", {
      status: "running",
      message: "Starting a watch and cancelling a one-shot request"
    });

    const controller = new AbortController();
    const cancellationReason = new Error("cancel one-shot, keep watch");

    try {
      const permission = await requestLocationPermission();
      if (permission !== "granted") {
        throw new Error(`Permission was not granted: ${permission}`);
      }

      const watchedPosition = await runWithNativeGeolocation(
        () =>
          new Promise<GeolocationResponse>((resolve, reject) => {
            let token = "";
            let didFinish = false;
            let oneShotStarted = false;
            let cancellationConfirmed = false;
            const timeout = setTimeout(() => {
              finish(() =>
                reject(
                  new Error(
                    "Watch did not deliver after the one-shot request was cancelled."
                  )
                )
              );
            }, 30000);
            const finish = (callback: () => void) => {
              if (didFinish) return;
              didFinish = true;
              clearTimeout(timeout);
              if (token) unwatch(token);
              callback();
            };
            const requestOptions = {
              accuracy: { android: "high" as const, ios: "best" as const },
              maximumAge: 0,
              timeout: 30000
            };

            token = watchPosition(
              (position) => {
                if (!oneShotStarted) {
                  oneShotStarted = true;
                  const cancelledRequest = getCurrentPosition({
                    ...requestOptions,
                    signal: controller.signal
                  });
                  abortWithReason(controller, cancellationReason);

                  cancelledRequest.then(
                    () =>
                      finish(() =>
                        reject(
                          new Error(
                            "Cancelled one-shot request unexpectedly resolved."
                          )
                        )
                      ),
                    (error) => {
                      try {
                        assertAbortOutcome(
                          error,
                          controller.signal,
                          cancellationReason
                        );
                        cancellationConfirmed = true;
                        setResult("watchIsolation", {
                          status: "running",
                          message:
                            "One-shot cancelled; move location for the active watch."
                        });
                      } catch (assertionError) {
                        finish(() => reject(assertionError));
                      }
                    }
                  );
                  return;
                }

                if (!cancellationConfirmed || !isConcurrencyFixture(position)) {
                  return;
                }
                finish(() => resolve(position));
              },
              (error) => finish(() => reject(error)),
              requestOptions
            );
          })
      );

      const coordinates = formatCoordinates(watchedPosition);
      setResult("watchIsolation", {
        status: "passed",
        message: `One-shot cancellation kept watch active at ${coordinates}.`
      });
    } catch (error) {
      setResult("watchIsolation", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      controller.abort();
      await refreshPermission();
    }
  };

  return (
    <ScenarioScreen
      prefix={PREFIX}
      title="Cancellable Current Position"
      subtitle="AbortSignal cancellation without cross-request interference"
    >
      <ScenarioSection index={1} title="Permission">
        <PermissionStatusBlock prefix={PREFIX} status={permissionStatus} />
      </ScenarioSection>

      <ScenarioSection index={2} title="Pre-aborted Signal" divided>
        <ScenarioButton
          title="Run Pre-aborted Request"
          onPress={runPreAbortedScenario}
          testID={`${PREFIX}-run-pre-aborted-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="pre-aborted"
          label="Pre-aborted request"
          result={results.preAborted}
        />
      </ScenarioSection>

      <ScenarioSection index={3} title="Concurrent Cache Read" divided>
        <ScenarioButton
          title="Read Cache While Starting Watch"
          onPress={runCacheIsolationScenario}
          color="#455A64"
          testID={`${PREFIX}-run-cache-isolation-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="cache-isolation"
          label="Cache read isolation"
          result={results.cacheIsolation}
        />
      </ScenarioSection>

      <ScenarioSection index={4} title="Concurrent Requests" divided>
        <ScenarioButton
          title="Run Isolated Cancellation"
          onPress={runIsolationScenario}
          color="#7B1FA2"
          testID={`${PREFIX}-run-isolation-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="isolation"
          label="Isolated cancellation"
          result={results.isolation}
        />
      </ScenarioSection>

      <ScenarioSection index={5} title="Active Watch" divided>
        <ScenarioButton
          title="Cancel One-shot While Watching"
          onPress={runWatchIsolationScenario}
          color="#00695C"
          testID={`${PREFIX}-run-watch-isolation-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="watch-isolation"
          label="Watch isolation"
          result={results.watchIsolation}
        />
      </ScenarioSection>
    </ScenarioScreen>
  );
}
