import React, { useEffect, useState } from "react";
import { Button, ScrollView, Text, View } from "react-native";
import {
  LocationErrorCode,
  checkPermission,
  getHeading,
  requestPermission,
  unwatch,
  watchHeading
} from "react-native-nitro-geolocation";
import type { Heading } from "react-native-nitro-geolocation";
import {
  ResultBlock,
  assertLocationErrorCode,
  createIdleResult,
  getDisplayErrorMessage,
  sharedStyles
} from "./scenarioUtils";
import type { ScenarioResult } from "./scenarioUtils";

const PREFIX = "heading";
const WATCH_TIMEOUT_MS = 15000;

const initialResults = {
  current: createIdleResult(),
  watch: createIdleResult(),
  invalid: createIdleResult(),
  denied: createIdleResult()
};

const assertHeading = (heading: Heading) => {
  if (
    !Number.isFinite(heading.magneticHeading) ||
    heading.magneticHeading < 0 ||
    heading.magneticHeading >= 360
  ) {
    throw new Error(`Invalid magnetic heading: ${heading.magneticHeading}`);
  }

  if (
    heading.trueHeading !== undefined &&
    (!Number.isFinite(heading.trueHeading) ||
      heading.trueHeading < 0 ||
      heading.trueHeading >= 360)
  ) {
    throw new Error(`Invalid true heading: ${heading.trueHeading}`);
  }

  if (heading.accuracy !== undefined && !Number.isFinite(heading.accuracy)) {
    throw new Error(`Invalid heading accuracy: ${heading.accuracy}`);
  }

  if (!Number.isFinite(heading.timestamp) || heading.timestamp <= 0) {
    throw new Error(`Invalid heading timestamp: ${heading.timestamp}`);
  }

  return `${heading.magneticHeading.toFixed(1)}deg`;
};

export default function HeadingScreen() {
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

  const ensurePermission = async () => {
    const status = await requestPermission();
    setPermissionStatus(status);
    if (status !== "granted") {
      throw new Error(`Permission was not granted: ${status}`);
    }
  };

  const runGetHeadingScenario = async () => {
    setResult("current", {
      status: "running",
      message: "Requesting one native heading reading"
    });

    try {
      await ensurePermission();
      const startedAt = Date.now();
      const heading = await getHeading();
      const summary = assertHeading(heading);
      const elapsedMs = Date.now() - startedAt;

      if (elapsedMs > WATCH_TIMEOUT_MS) {
        throw new Error(`Heading took ${elapsedMs}ms.`);
      }

      setResult("current", {
        status: "passed",
        message: `Single heading ${summary}; resolved in ${elapsedMs}ms.`
      });
    } catch (error) {
      setResult("current", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      await refreshPermission();
    }
  };

  const runWatchHeadingScenario = async () => {
    setResult("watch", {
      status: "running",
      message: "Watching native heading until two sensor updates arrive"
    });

    try {
      await ensurePermission();
      const readings: Heading[] = [];
      let token = "";

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (token) {
            unwatch(token);
          }
          reject(
            new Error(
              `Expected two heading updates, received ${readings.length}.`
            )
          );
        }, WATCH_TIMEOUT_MS);

        token = watchHeading(
          (heading) => {
            try {
              assertHeading(heading);
              readings.push(heading);

              if (readings.length >= 2) {
                clearTimeout(timeout);
                unwatch(token);
                resolve();
              }
            } catch (error) {
              clearTimeout(timeout);
              if (token) {
                unwatch(token);
              }
              reject(error);
            }
          },
          (error) => {
            clearTimeout(timeout);
            if (token) {
              unwatch(token);
            }
            reject(error);
          },
          {
            headingFilter: 0
          }
        );
      });

      if (readings[1].timestamp < readings[0].timestamp) {
        throw new Error("Heading watch timestamps moved backwards.");
      }

      setResult("watch", {
        status: "passed",
        message: `Watch delivered ${readings.length} real heading updates and cleaned up token ${token.slice(
          0,
          8
        )}.`
      });
    } catch (error) {
      setResult("watch", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      await refreshPermission();
    }
  };

  const runInvalidFilterScenario = async () => {
    setResult("invalid", {
      status: "running",
      message: "Starting a watch with an invalid headingFilter"
    });

    try {
      await new Promise<void>((resolve, reject) => {
        let didFinish = false;
        let token = "";
        token = watchHeading(
          () => {
            if (didFinish) return;
            didFinish = true;
            if (token) {
              unwatch(token);
            }
            reject(new Error("Invalid headingFilter unexpectedly emitted."));
          },
          (error) => {
            if (didFinish) return;
            didFinish = true;
            if (token) {
              unwatch(token);
            }
            try {
              assertLocationErrorCode(error, LocationErrorCode.INTERNAL_ERROR);
              resolve();
            } catch (assertionError) {
              reject(assertionError);
            }
          },
          {
            headingFilter: -1
          }
        );
      });

      setResult("invalid", {
        status: "passed",
        message: "Invalid headingFilter rejected before heading watch updates."
      });
    } catch (error) {
      setResult("invalid", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    }
  };

  const runDeniedScenario = async () => {
    setResult("denied", {
      status: "running",
      message: "Requesting heading without location permission"
    });

    try {
      await getHeading();
      setResult("denied", {
        status: "failed",
        message: "Permission-denied heading unexpectedly resolved."
      });
    } catch (error) {
      try {
        const locationError = assertLocationErrorCode(
          error,
          LocationErrorCode.PERMISSION_DENIED
        );
        setResult("denied", {
          status: "passed",
          message: `${locationError.name}: heading follows native permission checks.`
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
        <Text style={sharedStyles.title}>Heading</Text>
        <Text style={sharedStyles.subtitle}>
          Compass-style heading contract with watch and rejection paths
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
        <Text style={sharedStyles.sectionTitle}>2. Single Heading</Text>
        <View style={sharedStyles.buttonContainer}>
          <Button
            title="Get Heading"
            onPress={runGetHeadingScenario}
            color="#1976D2"
            testID={`${PREFIX}-run-current-button`}
          />
        </View>
        <ResultBlock
          prefix={PREFIX}
          id="current"
          label="Single heading"
          result={results.current}
        />
      </View>

      <View style={sharedStyles.divider} />

      <View style={sharedStyles.section}>
        <Text style={sharedStyles.sectionTitle}>3. Heading Watch</Text>
        <View style={sharedStyles.buttonContainer}>
          <Button
            title="Watch Heading"
            onPress={runWatchHeadingScenario}
            color="#00897B"
            testID={`${PREFIX}-run-watch-button`}
          />
        </View>
        <ResultBlock
          prefix={PREFIX}
          id="watch"
          label="Heading watch"
          result={results.watch}
        />
      </View>

      <View style={sharedStyles.divider} />

      <View style={sharedStyles.section}>
        <Text style={sharedStyles.sectionTitle}>4. Invalid Filter</Text>
        <View style={sharedStyles.buttonContainer}>
          <Button
            title="Run Invalid Filter"
            onPress={runInvalidFilterScenario}
            color="#D84315"
            testID={`${PREFIX}-run-invalid-button`}
          />
        </View>
        <ResultBlock
          prefix={PREFIX}
          id="invalid"
          label="Invalid filter"
          result={results.invalid}
        />
      </View>

      <View style={sharedStyles.divider} />

      <View style={sharedStyles.section}>
        <Text style={sharedStyles.sectionTitle}>5. Permission Denied</Text>
        <View style={sharedStyles.buttonContainer}>
          <Button
            title="Run Denied Heading"
            onPress={runDeniedScenario}
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
