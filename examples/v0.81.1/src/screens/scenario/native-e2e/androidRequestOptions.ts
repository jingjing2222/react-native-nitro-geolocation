import { Platform } from "react-native";
import {
  LocationErrorCode,
  getCurrentPosition,
  getLastKnownPosition,
  setConfiguration,
  unwatch,
  watchHeading,
  watchPosition
} from "react-native-nitro-geolocation";
import type {
  GeolocationResponse,
  LocationRequestOptions
} from "react-native-nitro-geolocation";
import { usePermissionStatus } from "../hooks/usePermissionStatus";
import { useScenarioResults } from "../hooks/useScenarioResults";
import {
  SEOUL_FIXTURE,
  assertFixtureCoordinates
} from "../utils/locationAssertions";
import {
  assertLocationErrorCode,
  getDisplayErrorMessage
} from "../utils/locationErrors";
import { runWithNativeGeolocation } from "../utils/nativeGeolocation";
import { createScenarioResults } from "../utils/results";

const ANDROID_COARSE_COORDINATE_TOLERANCE = 0.03;
const WATCH_TIMEOUT_MS = 20000;

export const androidRequestOptionsResults = createScenarioResults([
  "fused",
  "oneShotDistance",
  "coarseCache",
  "mixedWatch",
  "maxUpdates",
  "headingUnwatch",
  "invalid",
  "fineDenied"
] as const);

export type AndroidRequestOptionsResultKey =
  keyof typeof androidRequestOptionsResults;

const assertFinitePosition = (position: GeolocationResponse) => {
  if (
    !Number.isFinite(position.coords.latitude) ||
    !Number.isFinite(position.coords.longitude)
  ) {
    throw new Error("Watch position contained non-finite coordinates.");
  }
};

const assertNotExactFixtureCoordinates = (position: GeolocationResponse) => {
  const latitudeDelta = Math.abs(
    position.coords.latitude - SEOUL_FIXTURE.latitude
  );
  const longitudeDelta = Math.abs(
    position.coords.longitude - SEOUL_FIXTURE.longitude
  );

  if (latitudeDelta < 0.00001 && longitudeDelta < 0.00001) {
    throw new Error(
      "Coarse watcher received the exact injected fine coordinates."
    );
  }
};

const assertAndroidCoarseFixtureCoordinates = (
  position: GeolocationResponse
) => {
  return assertFixtureCoordinates(position, {
    coordinateTolerance: ANDROID_COARSE_COORDINATE_TOLERANCE
  });
};

const configurePlayServices = () => {
  setConfiguration({
    locationProvider: Platform.OS === "android" ? "playServices" : "auto"
  });
};

export const useAndroidRequestOptionsScenario = () => {
  const { permissionStatus, refreshPermission, ensurePermission } =
    usePermissionStatus();
  const { results, setResult } = useScenarioResults(
    androidRequestOptionsResults
  );

  const runFusedRequestScenario = async () => {
    setResult("fused", {
      status: "running",
      message: "Requesting high accuracy with coarse granularity through Fused"
    });

    try {
      await ensurePermission();
      configurePlayServices();

      const position = await runWithNativeGeolocation(() =>
        getCurrentPosition({
          accuracy: {
            android: "high",
            ios: "best"
          },
          granularity: "coarse",
          waitForAccurateLocation: true,
          maxUpdateAge: 0,
          maxUpdateDelay: 0,
          maximumAge: 0,
          timeout: 15000
        })
      );
      const coordinates = assertAndroidCoarseFixtureCoordinates(position);

      if (Platform.OS === "android" && position.provider === "gps") {
        throw new Error("coarse granularity unexpectedly returned GPS.");
      }

      setResult("fused", {
        status: "passed",
        message: `Fused coarse request returned ${coordinates}; provider=${position.provider ?? "unknown"}.`
      });
    } catch (error) {
      setResult("fused", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      await refreshPermission();
    }
  };

  const runMaxUpdatesScenario = async () => {
    setResult("maxUpdates", {
      status: "running",
      message: "Watching location until maxUpdates stops the subscription"
    });

    try {
      await ensurePermission();
      configurePlayServices();
      const readings: GeolocationResponse[] = [];
      let token = "";

      await runWithNativeGeolocation(
        () =>
          new Promise<void>((resolve, reject) => {
            let didFinish = false;
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
                  readings.push(position);

                  if (readings.length === 1) {
                    setTimeout(() => {
                      if (didFinish) return;
                      didFinish = true;
                      clearTimeout(timeout);
                      unwatch(token);
                      resolve();
                    }, 1500);
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
                maxUpdateDelay: 0,
                maxUpdates: 1
              }
            );
          })
      );

      setResult("maxUpdates", {
        status: "passed",
        message: `Watch stopped after ${readings.length} update with maxUpdates=1.`
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

  const runOneShotDistanceFilterScenario = async () => {
    setResult("oneShotDistance", {
      status: "running",
      message: "Requesting one Fused fix with a watch-only distanceFilter"
    });

    try {
      await ensurePermission();
      configurePlayServices();

      const startedAt = Date.now();
      const position = await runWithNativeGeolocation(() =>
        getCurrentPosition({
          accuracy: {
            android: "high"
          },
          distanceFilter: 1_000_000,
          maximumAge: 0,
          maxUpdateAge: 0,
          maxUpdateDelay: 0,
          timeout: 7000
        })
      );
      const coordinates = assertFixtureCoordinates(position);
      const elapsedMs = Date.now() - startedAt;

      setResult("oneShotDistance", {
        status: "passed",
        message: `One-shot request ignored watch-only distanceFilter=1000000m and returned ${coordinates} in ${elapsedMs}ms.`
      });
    } catch (error) {
      setResult("oneShotDistance", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      await refreshPermission();
    }
  };

  const runCoarseCacheScenario = async () => {
    setResult("coarseCache", {
      status: "running",
      message: "Seeding a fine fused fix before a coarse cache-only read"
    });

    try {
      await ensurePermission();
      configurePlayServices();

      await runWithNativeGeolocation(() =>
        getCurrentPosition({
          accuracy: {
            android: "high"
          },
          granularity: "fine",
          maximumAge: 0,
          timeout: 15000
        })
      );

      await runWithNativeGeolocation(() =>
        getLastKnownPosition({
          granularity: "coarse"
        })
      );

      setResult("coarseCache", {
        status: "failed",
        message: "Coarse cache read unexpectedly returned a fused fine fix."
      });
    } catch (error) {
      try {
        const locationError = assertLocationErrorCode(
          error,
          LocationErrorCode.POSITION_UNAVAILABLE
        );
        setResult("coarseCache", {
          status: "passed",
          message: `${locationError.name}: coarse cache-only read did not reuse an ungranular fused lastLocation.`
        });
      } catch (assertionError) {
        setResult("coarseCache", {
          status: "failed",
          message: getDisplayErrorMessage(assertionError)
        });
      }
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
                maxUpdateDelay: 0
              }
            );

            fineToken = watchPosition(
              (position) => {
                try {
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
                maxUpdateDelay: 0
              }
            );
          })
      );

      if (!coarseReading || !fineReading) {
        throw new Error("Mixed watch did not deliver both subscriptions.");
      }

      const coarseCoordinates =
        assertAndroidCoarseFixtureCoordinates(coarseReading);
      const fineCoordinates = assertFixtureCoordinates(fineReading);
      assertNotExactFixtureCoordinates(coarseReading);

      if (coarseReading.provider === "gps") {
        throw new Error("Coarse watcher unexpectedly received GPS.");
      }

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

      await runWithNativeGeolocation(
        () =>
          new Promise<void>((resolve, reject) => {
            let locationToken = "";
            let headingToken = "";
            let didFinish = false;

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
                  readings.push(position);

                  if (readings.length === 1) {
                    const nextHeadingToken = watchHeading(() => {}, fail, {
                      headingFilter: 0
                    });
                    if (didFinish) return;
                    headingToken = nextHeadingToken;
                    unwatch(headingToken);
                    headingToken = "";

                    setTimeout(() => {
                      clearTimeout(timeout);
                      finish();
                    }, 2500);
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
                maxUpdateDelay: 0,
                maxUpdates: 1
              }
            );
          })
      );

      const coordinates = assertFixtureCoordinates(readings[0]);
      setResult("headingUnwatch", {
        status: "passed",
        message: `Heading unwatch left maxUpdates=1 location watch stopped after ${readings.length} reading at ${coordinates}.`
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

  const runInvalidMaxUpdatesScenario = async () => {
    setResult("invalid", {
      status: "running",
      message: "Starting a watch with maxUpdates=0"
    });

    try {
      await runWithNativeGeolocation(
        () =>
          new Promise<void>((resolve, reject) => {
            let token = "";
            let didFinish = false;
            token = watchPosition(
              () => {
                if (didFinish) return;
                didFinish = true;
                if (token) {
                  unwatch(token);
                }
                reject(new Error("Invalid maxUpdates unexpectedly emitted."));
              },
              (error) => {
                if (didFinish) return;
                didFinish = true;
                if (token) {
                  unwatch(token);
                }
                try {
                  assertLocationErrorCode(
                    error,
                    LocationErrorCode.INTERNAL_ERROR
                  );
                  resolve();
                } catch (assertionError) {
                  reject(assertionError);
                }
              },
              {
                maxUpdates: 0
              } as LocationRequestOptions
            );
          })
      );

      setResult("invalid", {
        status: "passed",
        message: "maxUpdates=0 rejected before starting native updates."
      });
    } catch (error) {
      setResult("invalid", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    }
  };

  const runFineDeniedScenario = async () => {
    setResult("fineDenied", {
      status: "running",
      message: "Requesting fine granularity with coarse-only permission"
    });

    try {
      configurePlayServices();
      await runWithNativeGeolocation(() =>
        getCurrentPosition({
          granularity: "fine",
          maximumAge: 0,
          timeout: 5000
        })
      );

      setResult("fineDenied", {
        status: "failed",
        message: "Fine granularity unexpectedly resolved."
      });
    } catch (error) {
      try {
        const locationError = assertLocationErrorCode(
          error,
          LocationErrorCode.PERMISSION_DENIED
        );
        setResult("fineDenied", {
          status: "passed",
          message: `${locationError.name}: coarse-only permission cannot satisfy granularity=fine.`
        });
      } catch (assertionError) {
        setResult("fineDenied", {
          status: "failed",
          message: getDisplayErrorMessage(assertionError)
        });
      }
    } finally {
      await refreshPermission();
    }
  };

  return {
    permissionStatus,
    results,
    runFusedRequestScenario,
    runOneShotDistanceFilterScenario,
    runCoarseCacheScenario,
    runMixedWatchScenario,
    runMaxUpdatesScenario,
    runHeadingUnwatchScenario,
    runInvalidMaxUpdatesScenario,
    runFineDeniedScenario
  };
};
