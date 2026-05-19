import {
  unwatch,
  watchHeading,
  watchPosition
} from "react-native-nitro-geolocation";
import type { GeolocationResponse } from "react-native-nitro-geolocation";
import { assertFixtureCoordinates } from "../utils/locationAssertions";
import { getDisplayErrorMessage } from "../utils/locationErrors";
import { runWithNativeGeolocation } from "../utils/nativeGeolocation";
import {
  WATCH_FRESHNESS_GRACE_MS,
  WATCH_SECOND_UPDATE_QUIET_WINDOW_MS,
  WATCH_TIMEOUT_MS,
  assertAndroidCoarseFixtureCoordinates,
  assertFinitePosition,
  assertFreshWatchReading,
  assertNotExactFixtureCoordinates,
  configurePlayServices,
  requestSecondUpdateProbe
} from "./androidRequestOptionHelpers";
import type { AndroidRequestOptionsSetResult } from "./androidRequestOptionsResults";

type WatchOptionRunnerDeps = {
  ensurePermission: () => Promise<unknown>;
  refreshPermission: () => Promise<unknown>;
  setResult: AndroidRequestOptionsSetResult;
};

export const createAndroidWatchOptionRunners = ({
  ensurePermission,
  refreshPermission,
  setResult
}: WatchOptionRunnerDeps) => {
  const runMaxUpdatesScenario = async () => {
    setResult("maxUpdates", {
      status: "running",
      message: "Watching location until maxUpdates stops the subscription"
    });

    try {
      await ensurePermission();
      configurePlayServices();
      const readings: GeolocationResponse[] = [];
      let secondProbeCoordinates = "";
      let token = "";

      await runWithNativeGeolocation(
        () =>
          new Promise<void>((resolve, reject) => {
            let didFinish = false;
            const startedAt = Date.now();
            const timeout = setTimeout(() => {
              if (didFinish) return;
              didFinish = true;
              if (token) {
                unwatch(token);
              }
              reject(
                new Error(
                  `Expected 1 watch update, received ${readings.length}.`
                )
              );
            }, WATCH_TIMEOUT_MS);

            token = watchPosition(
              (position) => {
                if (didFinish) return;

                try {
                  assertFinitePosition(position);
                  assertFixtureCoordinates(position);
                  assertFreshWatchReading(position, startedAt, "Max updates");
                  readings.push(position);

                  if (readings.length === 1) {
                    setResult("maxUpdates", {
                      status: "running",
                      message:
                        "Max updates first reading received; inject another location"
                    });

                    setTimeout(async () => {
                      if (didFinish) return;
                      try {
                        secondProbeCoordinates =
                          await requestSecondUpdateProbe("Max updates");
                        if (didFinish) return;
                        didFinish = true;
                        clearTimeout(timeout);
                        unwatch(token);
                        resolve();
                      } catch (error) {
                        didFinish = true;
                        clearTimeout(timeout);
                        unwatch(token);
                        reject(error);
                      }
                    }, WATCH_SECOND_UPDATE_QUIET_WINDOW_MS);
                  } else if (readings.length > 1) {
                    didFinish = true;
                    clearTimeout(timeout);
                    unwatch(token);
                    reject(
                      new Error("maxUpdates allowed more than one update.")
                    );
                  }
                } catch (error) {
                  didFinish = true;
                  clearTimeout(timeout);
                  unwatch(token);
                  reject(error);
                }
              },
              (error) => {
                if (didFinish) return;
                didFinish = true;
                clearTimeout(timeout);
                if (token) {
                  unwatch(token);
                }
                reject(error);
              },
              {
                accuracy: {
                  android: "high"
                },
                granularity: "permission",
                interval: 500,
                fastestInterval: 100,
                maxUpdateAge: 0,
                maxUpdateDelay: 0,
                maxUpdates: 1
              }
            );

            setResult("maxUpdates", {
              status: "running",
              message: "Max updates watch active; inject first location"
            });
          })
      );

      setResult("maxUpdates", {
        status: "passed",
        message: `Watch stopped after ${readings.length} update with maxUpdates=1 while second location reached ${secondProbeCoordinates}.`
      });
    } catch (error) {
      setResult("maxUpdates", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      await refreshPermission();
    }
  };

  const runMixedWatchScenario = async () => {
    setResult("mixedWatch", {
      status: "running",
      message: "Starting simultaneous coarse and fine Fused watches"
    });

    try {
      await ensurePermission();
      configurePlayServices();

      let coarseReading: GeolocationResponse | undefined;
      let fineReading: GeolocationResponse | undefined;
      const startedAt = Date.now();

      await runWithNativeGeolocation(
        () =>
          new Promise<void>((resolve, reject) => {
            let coarseToken = "";
            let fineToken = "";
            let didFinish = false;

            const cleanup = () => {
              if (coarseToken) {
                unwatch(coarseToken);
              }
              if (fineToken) {
                unwatch(fineToken);
              }
            };

            const timeout = setTimeout(() => {
              if (didFinish) return;
              didFinish = true;
              cleanup();
              reject(
                new Error(
                  `Expected mixed watch readings; coarse=${Boolean(coarseReading)} fine=${Boolean(fineReading)}.`
                )
              );
            }, WATCH_TIMEOUT_MS);

            const finishIfReady = () => {
              if (!coarseReading || !fineReading || didFinish) return;
              didFinish = true;
              clearTimeout(timeout);
              cleanup();
              resolve();
            };

            const fail = (error: unknown) => {
              if (didFinish) return;
              didFinish = true;
              clearTimeout(timeout);
              cleanup();
              reject(error);
            };

            coarseToken = watchPosition(
              (position) => {
                try {
                  if (
                    position.timestamp <
                    startedAt - WATCH_FRESHNESS_GRACE_MS
                  ) {
                    return;
                  }
                  assertFinitePosition(position);
                  coarseReading = position;
                  finishIfReady();
                } catch (error) {
                  fail(error);
                }
              },
              fail,
              {
                accuracy: {
                  android: "high"
                },
                granularity: "coarse",
                interval: 500,
                fastestInterval: 100,
                maxUpdateAge: 0,
                maxUpdateDelay: 0
              }
            );

            fineToken = watchPosition(
              (position) => {
                try {
                  if (
                    position.timestamp <
                    startedAt - WATCH_FRESHNESS_GRACE_MS
                  ) {
                    return;
                  }
                  assertFinitePosition(position);
                  fineReading = position;
                  finishIfReady();
                } catch (error) {
                  fail(error);
                }
              },
              fail,
              {
                accuracy: {
                  android: "high"
                },
                granularity: "fine",
                interval: 500,
                fastestInterval: 100,
                maxUpdateAge: 0,
                maxUpdateDelay: 0
              }
            );

            setResult("mixedWatch", {
              status: "running",
              message: "Mixed watches active; waiting for seeded fixture"
            });
          })
      );

      if (!coarseReading || !fineReading) {
        throw new Error("Mixed watch did not deliver both subscriptions.");
      }

      const coarseCoordinates =
        assertAndroidCoarseFixtureCoordinates(coarseReading);
      const fineCoordinates = assertFixtureCoordinates(fineReading);
      assertNotExactFixtureCoordinates(coarseReading, "Coarse watcher");
      assertFreshWatchReading(coarseReading, startedAt, "Coarse");
      assertFreshWatchReading(fineReading, startedAt, "Fine");

      setResult("mixedWatch", {
        status: "passed",
        message: `Coarse watcher stayed coarse at ${coarseCoordinates}; fine watcher received ${fineCoordinates}.`
      });
    } catch (error) {
      setResult("mixedWatch", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      await refreshPermission();
    }
  };

  const runHeadingUnwatchScenario = async () => {
    setResult("headingUnwatch", {
      status: "running",
      message:
        "Unwatching a heading token while a maxUpdates location watch is idle"
    });

    try {
      await ensurePermission();
      configurePlayServices();
      const readings: GeolocationResponse[] = [];
      let secondProbeCoordinates = "";

      await runWithNativeGeolocation(
        () =>
          new Promise<void>((resolve, reject) => {
            let locationToken = "";
            let headingToken = "";
            let didFinish = false;
            const startedAt = Date.now();

            const cleanup = () => {
              if (locationToken) {
                unwatch(locationToken);
              }
              if (headingToken) {
                unwatch(headingToken);
              }
            };

            const finish = () => {
              if (didFinish) return;
              didFinish = true;
              cleanup();
              resolve();
            };

            const fail = (error: unknown) => {
              if (didFinish) return;
              didFinish = true;
              cleanup();
              reject(error);
            };

            const timeout = setTimeout(() => {
              fail(
                new Error(
                  `Expected a maxUpdates=1 location reading, received ${readings.length}.`
                )
              );
            }, WATCH_TIMEOUT_MS);

            locationToken = watchPosition(
              (position) => {
                try {
                  assertFinitePosition(position);
                  assertFixtureCoordinates(position);
                  assertFreshWatchReading(
                    position,
                    startedAt,
                    "Heading unwatch"
                  );
                  readings.push(position);

                  if (readings.length === 1) {
                    const nextHeadingToken = watchHeading(() => {}, fail, {
                      headingFilter: 0
                    });
                    if (didFinish) return;
                    headingToken = nextHeadingToken;
                    unwatch(headingToken);
                    headingToken = "";

                    setResult("headingUnwatch", {
                      status: "running",
                      message:
                        "Heading unwatch first reading received; inject another location"
                    });

                    setTimeout(async () => {
                      try {
                        secondProbeCoordinates =
                          await requestSecondUpdateProbe("Heading unwatch");
                        clearTimeout(timeout);
                        finish();
                      } catch (error) {
                        clearTimeout(timeout);
                        fail(error);
                      }
                    }, WATCH_SECOND_UPDATE_QUIET_WINDOW_MS);
                    return;
                  }

                  clearTimeout(timeout);
                  fail(
                    new Error(
                      "Heading unwatch restarted a maxUpdates=1 location watch."
                    )
                  );
                } catch (error) {
                  clearTimeout(timeout);
                  fail(error);
                }
              },
              (error) => {
                clearTimeout(timeout);
                fail(error);
              },
              {
                accuracy: {
                  android: "high"
                },
                granularity: "permission",
                interval: 500,
                fastestInterval: 100,
                maxUpdateAge: 0,
                maxUpdateDelay: 0,
                maxUpdates: 1
              }
            );

            setResult("headingUnwatch", {
              status: "running",
              message:
                "Heading unwatch location watch active; inject first location"
            });
          })
      );

      const coordinates = assertFixtureCoordinates(readings[0]);
      setResult("headingUnwatch", {
        status: "passed",
        message: `Heading unwatch left maxUpdates=1 location watch stopped after ${readings.length} reading at ${coordinates}; second location reached ${secondProbeCoordinates}.`
      });
    } catch (error) {
      setResult("headingUnwatch", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      await refreshPermission();
    }
  };

  return {
    runMaxUpdatesScenario,
    runMixedWatchScenario,
    runHeadingUnwatchScenario
  };
};
