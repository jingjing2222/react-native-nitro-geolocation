import React, { useEffect, useState } from "react";
import { Button, ScrollView, Text, View } from "react-native";
import {
  LocationErrorCode,
  checkPermission,
  getCurrentPosition,
  getLastKnownPosition,
  requestPermission
} from "react-native-nitro-geolocation";
import {
  ResultBlock,
  assertFixtureCoordinates,
  assertLocationErrorCode,
  captureLocationError,
  createIdleResult,
  getDisplayErrorMessage,
  runWithNativeGeolocation,
  sharedStyles
} from "./scenarioUtils";
import type { ScenarioResult } from "./scenarioUtils";

const PREFIX = "last-known-position";
const SYSTEM_CACHE_RETRY_TIMEOUT_MS = 10000;
const SYSTEM_CACHE_RETRY_INTERVAL_MS = 500;

const initialResults = {
  stale: createIdleResult(),
  system: createIdleResult(),
  cache: createIdleResult(),
  denied: createIdleResult()
};

export default function LastKnownPositionScreen() {
  const [permissionStatus, setPermissionStatus] = useState("unknown");
  const [results, setResults] = useState(initialResults);

  const setResult = (
    key: keyof typeof initialResults,
    result: ScenarioResult
  ) => {
    setResults((previous) => ({
      ...previous,
      [key]: result
    }));
  };

  const refreshPermission = async () => {
    const status = await checkPermission();
    setPermissionStatus(status);
    return status;
  };

  const requestLocationPermission = async () => {
    const status = await requestPermission();
    setPermissionStatus(status);
    return status;
  };

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

  useEffect(() => {
    refreshPermission();
  }, []);

  return (
    <ScrollView style={sharedStyles.container} testID={`${PREFIX}-screen`}>
      <View style={sharedStyles.header}>
        <Text style={sharedStyles.title}>Last Known Position</Text>
        <Text style={sharedStyles.subtitle}>
          Cached location API contract with rejection paths
        </Text>
      </View>

      <View style={sharedStyles.section}>
        <Text style={sharedStyles.sectionTitle}>1. Permission</Text>
        <View style={sharedStyles.statusContainer}>
          <Text style={sharedStyles.statusLabel}>Permission:</Text>
          <Text
            style={sharedStyles.statusValue}
            testID={`${PREFIX}-permission`}
          >
            {permissionStatus}
          </Text>
        </View>
      </View>

      <View style={sharedStyles.divider} />

      <View style={sharedStyles.section}>
        <Text style={sharedStyles.sectionTitle}>2. Stale Cache Rejection</Text>
        <View style={sharedStyles.buttonContainer}>
          <Button
            title="Reject Stale Cache"
            onPress={runStaleCacheScenario}
            color="#D84315"
            testID={`${PREFIX}-run-stale-button`}
          />
        </View>
        <ResultBlock
          prefix={PREFIX}
          id="stale"
          label="Stale cache"
          result={results.stale}
        />
      </View>

      <View style={sharedStyles.divider} />

      <View style={sharedStyles.section}>
        <Text style={sharedStyles.sectionTitle}>3. System Cache Read</Text>
        <View style={sharedStyles.buttonContainer}>
          <Button
            title="Read System Cache"
            onPress={runSystemCacheReadScenario}
            color="#00897B"
            testID={`${PREFIX}-run-system-button`}
          />
        </View>
        <ResultBlock
          prefix={PREFIX}
          id="system"
          label="System cache"
          result={results.system}
        />
      </View>

      <View style={sharedStyles.divider} />

      <View style={sharedStyles.section}>
        <Text style={sharedStyles.sectionTitle}>4. Seeded Cache Read</Text>
        <View style={sharedStyles.buttonContainer}>
          <Button
            title="Seed And Read Cache"
            onPress={runCacheReadScenario}
            color="#1976D2"
            testID={`${PREFIX}-run-cache-button`}
          />
        </View>
        <ResultBlock
          prefix={PREFIX}
          id="cache"
          label="Seeded cache"
          result={results.cache}
        />
      </View>

      <View style={sharedStyles.divider} />

      <View style={sharedStyles.section}>
        <Text style={sharedStyles.sectionTitle}>5. Permission Denied</Text>
        <View style={sharedStyles.buttonContainer}>
          <Button
            title="Run Denied Cache Read"
            onPress={runPermissionDeniedScenario}
            color="#7B1FA2"
            testID={`${PREFIX}-run-denied-button`}
          />
        </View>
        <ResultBlock
          prefix={PREFIX}
          id="denied"
          label="Permission denied"
          result={results.denied}
        />
      </View>
    </ScrollView>
  );
}
