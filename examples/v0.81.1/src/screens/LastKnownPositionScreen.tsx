import React from "react";
import {
  LocationErrorCode,
  getCurrentPosition,
  getLastKnownPosition
} from "react-native-nitro-geolocation";
import {
  PermissionStatusBlock,
  ResultBlock,
  ScenarioButton,
  ScenarioScreen,
  ScenarioSection,
  assertFixtureCoordinates,
  assertLocationErrorCode,
  captureLocationError,
  createScenarioResults,
  getDisplayErrorMessage,
  runWithNativeGeolocation,
  usePermissionStatus,
  useScenarioResults
} from "./scenario";

const PREFIX = "last-known-position";
const SYSTEM_CACHE_RETRY_TIMEOUT_MS = 10000;
const SYSTEM_CACHE_RETRY_INTERVAL_MS = 500;

const initialResults = createScenarioResults([
  "stale",
  "system",
  "cache",
  "denied"
] as const);

export default function LastKnownPositionScreen() {
  const { permissionStatus, refreshPermission, requestLocationPermission } =
    usePermissionStatus();
  const { results, setResult } = useScenarioResults(initialResults);

  const sleep = (durationMs: number) =>
    new Promise<void>((resolve) => {
      setTimeout(() => resolve(), durationMs);
    });

  const readSystemCacheOnly = async () => {
    const startedAt = Date.now();
    let lastUnavailableMessage = "No cached location available.";

    while (Date.now() - startedAt <= SYSTEM_CACHE_RETRY_TIMEOUT_MS) {
      try {
        const position = await runWithNativeGeolocation(() =>
          getLastKnownPosition()
        );
        return {
          elapsedMs: Date.now() - startedAt,
          position
        };
      } catch (error) {
        const locationError = captureLocationError(error);
        if (locationError.code !== LocationErrorCode.POSITION_UNAVAILABLE) {
          throw error;
        }

        lastUnavailableMessage = locationError.message;
        await sleep(SYSTEM_CACHE_RETRY_INTERVAL_MS);
      }
    }

    throw new Error(lastUnavailableMessage);
  };

  const runStaleCacheScenario = async () => {
    setResult("stale", {
      status: "running",
      message: "Rejecting cached reads that cannot satisfy maximumAge"
    });

    try {
      await runWithNativeGeolocation(() =>
        getLastKnownPosition({ maximumAge: 0 })
      );
      setResult("stale", {
        status: "failed",
        message: "Stale cache filter unexpectedly resolved."
      });
    } catch (error) {
      try {
        const locationError = assertLocationErrorCode(
          error,
          LocationErrorCode.POSITION_UNAVAILABLE
        );
        setResult("stale", {
          status: "passed",
          message: `${locationError.name}: stale or empty cache was rejected without starting a fresh request.`
        });
      } catch (assertionError) {
        setResult("stale", {
          status: "failed",
          message: getDisplayErrorMessage(assertionError)
        });
      }
    }
  };

  const runSystemCacheReadScenario = async () => {
    setResult("system", {
      status: "running",
      message: "Reading system/provider cache without seeding module state"
    });

    try {
      const status = await requestLocationPermission();
      if (status !== "granted") {
        throw new Error(`Permission was not granted: ${status}`);
      }

      const { elapsedMs, position } = await readSystemCacheOnly();
      const coordinates = assertFixtureCoordinates(position);

      setResult("system", {
        status: "passed",
        message: `System cache ${coordinates}; cache-only read ${elapsedMs}ms without getCurrentPosition.`
      });
    } catch (error) {
      setResult("system", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      await refreshPermission();
    }
  };

  const runCacheReadScenario = async () => {
    setResult("cache", {
      status: "running",
      message: "Seeding native cache with a fresh request"
    });

    try {
      const status = await requestLocationPermission();
      if (status !== "granted") {
        throw new Error(`Permission was not granted: ${status}`);
      }

      const fresh = await runWithNativeGeolocation(() =>
        getCurrentPosition({
          accuracy: {
            android: "high",
            ios: "best"
          },
          maximumAge: 0,
          timeout: 15000
        })
      );
      const freshCoordinates = assertFixtureCoordinates(fresh);
      const startedAt = Date.now();
      const cached = await runWithNativeGeolocation(() =>
        getLastKnownPosition()
      );
      const elapsedMs = Date.now() - startedAt;
      const cachedCoordinates = assertFixtureCoordinates(cached);
      const timestampDelta = Math.abs(cached.timestamp - fresh.timestamp);

      if (timestampDelta > 1000) {
        throw new Error(
          `Cached timestamp drifted by ${timestampDelta}ms from seeded location.`
        );
      }

      if (elapsedMs > 3000) {
        throw new Error(
          `Cached read took ${elapsedMs}ms, which suggests a fresh request path.`
        );
      }

      setResult("cache", {
        status: "passed",
        message: `Seeded ${freshCoordinates}; cached ${cachedCoordinates}; timestamp delta ${timestampDelta}ms; cache read ${elapsedMs}ms.`
      });
    } catch (error) {
      setResult("cache", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      await refreshPermission();
    }
  };

  const runPermissionDeniedScenario = async () => {
    setResult("denied", {
      status: "running",
      message: "Reading last known position without permission"
    });

    try {
      await runWithNativeGeolocation(() => getLastKnownPosition());
      setResult("denied", {
        status: "failed",
        message: "Permission-denied cached read unexpectedly resolved."
      });
    } catch (error) {
      try {
        const locationError = assertLocationErrorCode(
          error,
          LocationErrorCode.PERMISSION_DENIED
        );
        setResult("denied", {
          status: "passed",
          message: `${locationError.name}: cached read did not bypass native permission checks.`
        });
      } catch (assertionError) {
        setResult("denied", {
          status: "failed",
          message: getDisplayErrorMessage(assertionError)
        });
      }
    } finally {
      await refreshPermission();
    }
  };

  return (
    <ScenarioScreen
      prefix={PREFIX}
      title="Last Known Position"
      subtitle="Cached location API contract with rejection paths"
    >
      <ScenarioSection index={1} title="Permission">
        <PermissionStatusBlock prefix={PREFIX} status={permissionStatus} />
      </ScenarioSection>

      <ScenarioSection index={2} title="Stale Cache Rejection" divided>
        <ScenarioButton
          title="Reject Stale Cache"
          onPress={runStaleCacheScenario}
          color="#D84315"
          testID={`${PREFIX}-run-stale-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="stale"
          label="Stale cache"
          result={results.stale}
        />
      </ScenarioSection>

      <ScenarioSection index={3} title="System Cache Read" divided>
        <ScenarioButton
          title="Read System Cache"
          onPress={runSystemCacheReadScenario}
          color="#00897B"
          testID={`${PREFIX}-run-system-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="system"
          label="System cache"
          result={results.system}
        />
      </ScenarioSection>

      <ScenarioSection index={4} title="Seeded Cache Read" divided>
        <ScenarioButton
          title="Seed And Read Cache"
          onPress={runCacheReadScenario}
          testID={`${PREFIX}-run-cache-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="cache"
          label="Seeded cache"
          result={results.cache}
        />
      </ScenarioSection>

      <ScenarioSection index={5} title="Permission Denied" divided>
        <ScenarioButton
          title="Run Denied Cache Read"
          onPress={runPermissionDeniedScenario}
          color="#7B1FA2"
          testID={`${PREFIX}-run-denied-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="denied"
          label="Permission denied"
          result={results.denied}
        />
      </ScenarioSection>
    </ScenarioScreen>
  );
}
