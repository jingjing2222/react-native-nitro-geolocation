import React from "react";
import {
  LocationErrorCodes,
  getCurrentPosition,
  getLastKnownPosition,
  getLastKnownPositionAsync
} from "react-native-nitro-geolocation";
import {
  PermissionStatusBlock,
  ResultBlock,
  ScenarioButton,
  ScenarioScreen,
  ScenarioSection,
  assertFixtureCoordinates,
  assertLocationErrorCode,
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
  "cold",
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

    while (Date.now() - startedAt <= SYSTEM_CACHE_RETRY_TIMEOUT_MS) {
      const position = await runWithNativeGeolocation(() =>
        getLastKnownPositionAsync()
      );
      if (position) {
        return {
          elapsedMs: Date.now() - startedAt,
          position
        };
      }

      await sleep(SYSTEM_CACHE_RETRY_INTERVAL_MS);
    }

    throw new Error("No platform cached location became available.");
  };

  const runColdModuleCacheScenario = () => {
    setResult("cold", {
      status: "running",
      message: "Reading the in-memory cache before requesting a location"
    });

    const cached = getLastKnownPosition();
    setResult("cold", {
      status: cached ? "failed" : "passed",
      message: cached
        ? "Cold module cache unexpectedly contained a position."
        : "Cold module cache returned undefined without querying native location sources."
    });
  };

  const runStaleCacheScenario = async () => {
    setResult("stale", {
      status: "running",
      message: "Filtering out platform cache that cannot satisfy maximumAge"
    });

    try {
      const cached = await runWithNativeGeolocation(() =>
        getLastKnownPositionAsync({ maximumAge: 0 })
      );
      setResult("stale", {
        status: cached ? "failed" : "passed",
        message: cached
          ? "Stale cache filter unexpectedly returned a position."
          : "Stale or empty platform cache returned undefined without starting a fresh request."
      });
    } catch (error) {
      setResult("stale", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
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
      if (position.metadata?.source !== "platformCache") {
        throw new Error(
          `Expected platformCache metadata source, received ${position.metadata?.source ?? "none"}.`
        );
      }

      setResult("system", {
        status: "passed",
        message: `System cache ${coordinates}; source=${position.metadata.source}; cache-only read ${elapsedMs}ms without getCurrentPosition.`
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
      const cached = getLastKnownPosition();
      const elapsedMs = Date.now() - startedAt;
      if (!cached) {
        throw new Error("Seeded module cache unexpectedly returned undefined.");
      }
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
        message: `Seeded ${freshCoordinates}; sync module cache ${cachedCoordinates}; timestamp delta ${timestampDelta}ms; cache read ${elapsedMs}ms.`
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
      await runWithNativeGeolocation(() => getLastKnownPositionAsync());
      setResult("denied", {
        status: "failed",
        message: "Permission-denied cached read unexpectedly resolved."
      });
    } catch (error) {
      try {
        const locationError = assertLocationErrorCode(
          error,
          LocationErrorCodes.PERMISSION_DENIED
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
      subtitle="Synchronous module cache and asynchronous platform cache contracts"
    >
      <ScenarioSection index={1} title="Permission">
        <PermissionStatusBlock prefix={PREFIX} status={permissionStatus} />
      </ScenarioSection>

      <ScenarioSection index={2} title="Cold Module Cache" divided>
        <ScenarioButton
          title="Read Cold Module Cache"
          onPress={runColdModuleCacheScenario}
          color="#546E7A"
          testID={`${PREFIX}-run-cold-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="cold"
          label="Cold module cache"
          result={results.cold}
        />
      </ScenarioSection>

      <ScenarioSection index={3} title="Stale Platform Cache" divided>
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

      <ScenarioSection index={4} title="Platform Cache Read" divided>
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

      <ScenarioSection index={5} title="Seeded Module Cache Read" divided>
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

      <ScenarioSection index={6} title="Permission Denied" divided>
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
