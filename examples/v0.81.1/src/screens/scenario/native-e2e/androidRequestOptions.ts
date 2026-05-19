import {
  LocationErrorCode,
  getCurrentPosition,
  getLastKnownPosition,
  unwatch,
  watchPosition
} from "react-native-nitro-geolocation";
import type {
  GeolocationResponse,
  LocationRequestOptions
} from "react-native-nitro-geolocation";
import { usePermissionStatus } from "../hooks/usePermissionStatus";
import { useScenarioResults } from "../hooks/useScenarioResults";
import { assertFixtureCoordinates } from "../utils/locationAssertions";
import {
  assertLocationErrorCode,
  getDisplayErrorMessage
} from "../utils/locationErrors";
import { runWithNativeGeolocation } from "../utils/nativeGeolocation";
import { createAndroidProviderSelectionRunners } from "./androidProviderSelection";
import {
  WATCH_FRESHNESS_GRACE_MS,
  assertErrorMessageIncludes,
  assertFinitePosition,
  assertFreshPosition,
  assertNotExactFixtureCoordinates,
  configureAutoProvider,
  configurePlayServices,
  requestSeededCoarsePosition
} from "./androidRequestOptionHelpers";
import {
  type AndroidRequestOptionsResultKey,
  androidRequestOptionsResults
} from "./androidRequestOptionsResults";
import { createAndroidWatchOptionRunners } from "./androidWatchOptionScenarios";

export { androidRequestOptionsResults };
export type { AndroidRequestOptionsResultKey };

export const useAndroidRequestOptionsScenario = () => {
  const { permissionStatus, refreshPermission, ensurePermission } =
    usePermissionStatus();
  const { results, setResult } = useScenarioResults(
    androidRequestOptionsResults
  );

  const {
    runAutoProviderScenario,
    runPlayServicesProviderScenario,
    runPlatformProviderScenario
  } = createAndroidProviderSelectionRunners({
    ensurePermission,
    refreshPermission,
    setResult
  });

  const {
    runMaxUpdatesScenario,
    runMixedWatchScenario,
    runHeadingUnwatchScenario
  } = createAndroidWatchOptionRunners({
    ensurePermission,
    refreshPermission,
    setResult
  });

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
