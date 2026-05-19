import { Platform } from "react-native";
import {
  LocationErrorCode,
  getCurrentPosition,
  getLastKnownPosition,
  getProviderStatus,
  setConfiguration,
  unwatch,
  watchHeading,
  watchPosition
} from "react-native-nitro-geolocation";
import type {
  GeolocationResponse,
  LocationProviderStatus,
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
const EXACT_FIXTURE_COORDINATE_TOLERANCE = 0.000001;
const WATCH_TIMEOUT_MS = 30000;
const WATCH_FRESHNESS_GRACE_MS = 10000;
const WATCH_SECOND_UPDATE_QUIET_WINDOW_MS = 10000;
const PROVIDER_SELECTION_FRESHNESS_GRACE_MS = 30000;
const LIVE_PROVIDER_SELECTION_TIMEOUT_MS = 30000;
const REQUEST_OPTIONS_TIMEOUT_MS = 15000;
const SECOND_UPDATE_FIXTURE = {
  latitude: 37.5765,
  longitude: 126.988
};
const SECOND_UPDATE_COORDINATE_TOLERANCE = 0.003;

export const androidRequestOptionsResults = createScenarioResults([
  "autoProvider",
  "playServicesProvider",
  "platformProvider",
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
    throw new Error("Position contained non-finite coordinates.");
  }
};

const assertFreshPosition = (
  position: GeolocationResponse,
  startedAt: number,
  label: string,
  graceMs = WATCH_FRESHNESS_GRACE_MS
) => {
  if (position.timestamp < startedAt - graceMs) {
    throw new Error(
      `${label} returned stale timestamp ${position.timestamp}; startedAt=${startedAt}.`
    );
  }
};

const assertRealDevicePosition = (
  position: GeolocationResponse,
  startedAt?: number,
  label = "Provider selection"
) => {
  assertFinitePosition(position);

  if (Platform.OS === "android" && position.mocked !== false) {
    throw new Error(
      `Provider selection did not prove a real Android position; mocked=${position.mocked ?? "unknown"}.`
    );
  }

  if (startedAt !== undefined) {
    assertFreshPosition(
      position,
      startedAt,
      label,
      PROVIDER_SELECTION_FRESHNESS_GRACE_MS
    );
  }

  return `${position.coords.latitude.toFixed(
    6
  )}, ${position.coords.longitude.toFixed(6)}`;
};

const assertAndroidCoarseFixtureCoordinates = (
  position: GeolocationResponse
) => {
  return assertFixtureCoordinates(position, {
    coordinateTolerance: ANDROID_COARSE_COORDINATE_TOLERANCE
  });
};

const assertErrorMessageIncludes = (
  error: unknown,
  expectedMessage: string,
  label: string
) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message)
        : String(error);

  if (!message.includes(expectedMessage)) {
    throw new Error(
      `${label} returned unexpected native error message: ${message}`
    );
  }
};

const assertSecondUpdateCoordinates = (
  position: GeolocationResponse,
  label: string
) => {
  assertFinitePosition(position);

  const latitudeDelta = Math.abs(
    position.coords.latitude - SECOND_UPDATE_FIXTURE.latitude
  );
  const longitudeDelta = Math.abs(
    position.coords.longitude - SECOND_UPDATE_FIXTURE.longitude
  );

  if (
    latitudeDelta > SECOND_UPDATE_COORDINATE_TOLERANCE ||
    longitudeDelta > SECOND_UPDATE_COORDINATE_TOLERANCE
  ) {
    throw new Error(
      `${label} second-location probe did not match injected update: ${position.coords.latitude.toFixed(
        6
      )}, ${position.coords.longitude.toFixed(6)}.`
    );
  }

  return `${position.coords.latitude.toFixed(
    6
  )}, ${position.coords.longitude.toFixed(6)}`;
};

const requestSecondUpdateProbe = async (label: string) => {
  const position = await getCurrentPosition({
    accuracy: {
      android: "high"
    },
    granularity: "fine",
    maximumAge: 0,
    maxUpdateAge: 0,
    maxUpdateDelay: 0,
    timeout: 7000
  });

  if (Platform.OS === "android" && position.mocked !== true) {
    throw new Error(
      `${label} second-location probe was not mocked; mocked=${position.mocked ?? "unknown"}.`
    );
  }

  return assertSecondUpdateCoordinates(position, label);
};

const assertNotExactFixtureCoordinates = (
  position: GeolocationResponse,
  label: string
) => {
  const latitudeDelta = Math.abs(
    position.coords.latitude - SEOUL_FIXTURE.latitude
  );
  const longitudeDelta = Math.abs(
    position.coords.longitude - SEOUL_FIXTURE.longitude
  );

  if (
    latitudeDelta <= EXACT_FIXTURE_COORDINATE_TOLERANCE &&
    longitudeDelta <= EXACT_FIXTURE_COORDINATE_TOLERANCE
  ) {
    throw new Error(`${label} returned the exact seeded fine fixture.`);
  }
};

const configurePlayServices = () => {
  setConfiguration({
    locationProvider: Platform.OS === "android" ? "playServices" : "auto"
  });
};

const configureAutoProvider = () => {
  setConfiguration({
    locationProvider: "auto"
  });
};

const configurePlatformProvider = () => {
  setConfiguration({
    locationProvider: Platform.OS === "android" ? "android" : "auto"
  });
};

const configureNativePlatformProvider = () => {
  setConfiguration({
    locationProvider:
      Platform.OS === "android" ? ("android_platform" as "android") : "auto"
  });
};

const isAndroidPlatformProvider = (provider?: string) => {
  return provider === "gps" || provider === "network" || provider === "passive";
};

const hasGoogleLocationAccuracyStatus = (status: LocationProviderStatus) => {
  return (
    Platform.OS === "android" &&
    status.googleLocationAccuracyEnabled !== undefined
  );
};

const assertPreferredProvider = (
  position: GeolocationResponse,
  status: LocationProviderStatus,
  label: "auto" | "playServices"
) => {
  if (Platform.OS !== "android") {
    return `${label} returned native provider`;
  }

  if (
    position.provider !== "fused" &&
    !isAndroidPlatformProvider(position.provider)
  ) {
    throw new Error(
      `Expected ${label} to return fused or platform fallback provider, received ${position.provider ?? "unknown"}.`
    );
  }

  if (position.provider === "fused") {
    return hasGoogleLocationAccuracyStatus(status)
      ? `${label} returned fused provider with Google location accuracy status`
      : `${label} returned fused provider without Google location accuracy status`;
  }

  throw new Error(
    `Expected live ${label} provider-selection proof to return fused, received ${position.provider ?? "unknown"}.`
  );
};

const assertFreshWatchReading = (
  position: GeolocationResponse,
  startedAt: number,
  label: string
) => {
  assertFreshPosition(position, startedAt, `${label} watcher`);
};

const requestSeededCoarsePosition = async (label: "auto" | "playServices") => {
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
      timeout: REQUEST_OPTIONS_TIMEOUT_MS
    })
  );
  const coordinates = assertAndroidCoarseFixtureCoordinates(position);
  return `${label} coarse request returned ${coordinates}`;
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
      configureAutoProvider();

      const autoMessage = await requestSeededCoarsePosition("auto");

      configurePlayServices();

      const playServicesMessage =
        await requestSeededCoarsePosition("playServices");

      setResult("fused", {
        status: "passed",
        message: `${autoMessage}. ${playServicesMessage}.`
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

  const runAutoProviderScenario = async () => {
    setResult("autoProvider", {
      status: "running",
      message: "Requesting a live fix with locationProvider=auto"
    });

    try {
      await ensurePermission();
      configureAutoProvider();
      const providerStatus = await getProviderStatus();

      const startedAt = Date.now();
      const position = await runWithNativeGeolocation(() =>
        getCurrentPosition({
          accuracy: {
            android: "balanced",
            ios: "best"
          },
          granularity: "permission",
          maximumAge: 0,
          maxUpdateAge: 0,
          maxUpdateDelay: 0,
          timeout: LIVE_PROVIDER_SELECTION_TIMEOUT_MS
        })
      );
      const coordinates = assertRealDevicePosition(position, startedAt, "auto");
      const providerSelection = assertPreferredProvider(
        position,
        providerStatus,
        "auto"
      );

      setResult("autoProvider", {
        status: "passed",
        message: `${providerSelection} and returned ${coordinates}; provider=${position.provider ?? "unknown"}; mocked=${position.mocked ?? "unknown"}.`
      });
    } catch (error) {
      setResult("autoProvider", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      await refreshPermission();
    }
  };

  const runPlayServicesProviderScenario = async () => {
    setResult("playServicesProvider", {
      status: "running",
      message: "Requesting a live fix with locationProvider=playServices"
    });

    try {
      await ensurePermission();
      configurePlayServices();
      const providerStatus = await getProviderStatus();

      const startedAt = Date.now();
      const position = await runWithNativeGeolocation(() =>
        getCurrentPosition({
          accuracy: {
            android: "balanced",
            ios: "best"
          },
          granularity: "permission",
          maximumAge: 0,
          maxUpdateAge: 0,
          maxUpdateDelay: 0,
          timeout: LIVE_PROVIDER_SELECTION_TIMEOUT_MS
        })
      );
      const coordinates = assertRealDevicePosition(
        position,
        startedAt,
        "playServices"
      );
      const providerSelection = assertPreferredProvider(
        position,
        providerStatus,
        "playServices"
      );

      setResult("playServicesProvider", {
        status: "passed",
        message: `${providerSelection} and returned ${coordinates}; provider=${position.provider ?? "unknown"}; mocked=${position.mocked ?? "unknown"}.`
      });
    } catch (error) {
      setResult("playServicesProvider", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      await refreshPermission();
    }
  };

  const runPlatformProviderScenario = async () => {
    if (Platform.OS !== "android") {
      setResult("platformProvider", {
        status: "failed",
        message: "android_platform provider scenario is Android-only."
      });
      return;
    }

    try {
      await ensurePermission();

      const requestPlatformPosition = async (
        label: "android" | "android_platform",
        configureProvider: () => void
      ) => {
        setResult("platformProvider", {
          status: "running",
          message: `Requesting a fresh fix with locationProvider=${label}`
        });

        configureProvider();
        const startedAt = Date.now();
        const position = await runWithNativeGeolocation(() =>
          getCurrentPosition({
            accuracy: {
              android: "balanced",
              ios: "best"
            },
            granularity: "permission",
            maximumAge: 0,
            maxUpdateAge: 0,
            timeout: LIVE_PROVIDER_SELECTION_TIMEOUT_MS
          })
        );
        const coordinates = assertRealDevicePosition(
          position,
          startedAt,
          label
        );

        if (position.provider === "fused") {
          throw new Error(`${label} unexpectedly returned fused.`);
        }

        if (!isAndroidPlatformProvider(position.provider)) {
          throw new Error(
            `Expected ${label} platform provider, received ${position.provider ?? "unknown"}.`
          );
        }

        return `${label} returned ${coordinates}; provider=${position.provider ?? "unknown"}; mocked=${position.mocked ?? "unknown"}`;
      };

      const aliasMessage = await requestPlatformPosition(
        "android",
        configurePlatformProvider
      );
      const nativeMessage = await requestPlatformPosition(
        "android_platform",
        configureNativePlatformProvider
      );

      setResult("platformProvider", {
        status: "passed",
        message: `${aliasMessage}. ${nativeMessage}.`
      });
    } catch (error) {
      setResult("platformProvider", {
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
      assertFinitePosition(position);
      assertFreshPosition(
        position,
        startedAt,
        "One-shot distance",
        WATCH_FRESHNESS_GRACE_MS
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
      message: "Seeding a fine fix before a coarse cache-only read"
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

      let coarseCachePosition: GeolocationResponse;
      try {
        coarseCachePosition = await runWithNativeGeolocation(() =>
          getLastKnownPosition({
            granularity: "coarse"
          })
        );
      } catch (error) {
        const locationError = assertLocationErrorCode(
          error,
          LocationErrorCode.POSITION_UNAVAILABLE
        );
        setResult("coarseCache", {
          status: "passed",
          message: `${locationError.name}: coarse cache-only read did not reuse the fine cache.`
        });
        return;
      }

      assertFinitePosition(coarseCachePosition);
      assertNotExactFixtureCoordinates(coarseCachePosition, "Coarse cache");
      const coordinates = `${coarseCachePosition.coords.latitude.toFixed(
        6
      )}, ${coarseCachePosition.coords.longitude.toFixed(6)}`;

      setResult("coarseCache", {
        status: "passed",
        message: `Coarse cache-only read did not reuse the fine cache and returned ${coordinates}.`
      });
    } catch (error) {
      setResult("coarseCache", {
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
                  const locationError = assertLocationErrorCode(
                    error,
                    LocationErrorCode.INTERNAL_ERROR
                  );
                  assertErrorMessageIncludes(
                    error,
                    "maxUpdates must be greater than or equal to 1",
                    "maxUpdates=0"
                  );
                  setResult("invalid", {
                    status: "running",
                    message: `${locationError.name}: maxUpdates native validation matched expected message`
                  });
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
        assertErrorMessageIncludes(
          error,
          "Fine location permission is required for granularity=fine",
          "granularity=fine"
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
    runAutoProviderScenario,
    runPlayServicesProviderScenario,
    runPlatformProviderScenario,
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
