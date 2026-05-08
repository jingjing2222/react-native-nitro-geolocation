import React from "react";
import {
  LocationErrorCode,
  getHeading,
  unwatch,
  watchHeading
} from "react-native-nitro-geolocation";
import type { Heading } from "react-native-nitro-geolocation";
import {
  PermissionStatusBlock,
  ResultBlock,
  ScenarioButton,
  ScenarioScreen,
  ScenarioSection,
  assertLocationErrorCode,
  createScenarioResult,
  createScenarioResults,
  getDisplayErrorMessage,
  usePermissionStatus,
  useScenarioResults
} from "./scenario";

const PREFIX = "heading";
const WATCH_TIMEOUT_MS = 15000;

const initialResults = createScenarioResults([
  "current",
  "watch",
  "invalid",
  "denied"
] as const);

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
  const { permissionStatus, refreshPermission, ensurePermission } =
    usePermissionStatus();
  const { results, setResult } = useScenarioResults(initialResults);

  const runGetHeadingScenario = async () => {
    setResult(
      "current",
      createScenarioResult("running", "Requesting one native heading reading")
    );

    try {
      await ensurePermission();
      const startedAt = Date.now();
      const heading = await getHeading();
      const summary = assertHeading(heading);
      const elapsedMs = Date.now() - startedAt;

      if (elapsedMs > WATCH_TIMEOUT_MS) {
        throw new Error(`Heading took ${elapsedMs}ms.`);
      }

      setResult(
        "current",
        createScenarioResult(
          "passed",
          `Single heading ${summary}; resolved in ${elapsedMs}ms.`
        )
      );
    } catch (error) {
      setResult(
        "current",
        createScenarioResult("failed", getDisplayErrorMessage(error))
      );
    } finally {
      await refreshPermission();
    }
  };

  const runWatchHeadingScenario = async () => {
    setResult(
      "watch",
      createScenarioResult(
        "running",
        "Watching native heading until two sensor updates arrive"
      )
    );

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

      setResult(
        "watch",
        createScenarioResult(
          "passed",
          `Watch delivered ${readings.length} real heading updates and cleaned up token ${token.slice(
            0,
            8
          )}.`
        )
      );
    } catch (error) {
      setResult(
        "watch",
        createScenarioResult("failed", getDisplayErrorMessage(error))
      );
    } finally {
      await refreshPermission();
    }
  };

  const runInvalidFilterScenario = async () => {
    setResult(
      "invalid",
      createScenarioResult(
        "running",
        "Starting a watch with an invalid headingFilter"
      )
    );

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

      setResult(
        "invalid",
        createScenarioResult(
          "passed",
          "Invalid headingFilter rejected before heading watch updates."
        )
      );
    } catch (error) {
      setResult(
        "invalid",
        createScenarioResult("failed", getDisplayErrorMessage(error))
      );
    }
  };

  const runDeniedScenario = async () => {
    setResult(
      "denied",
      createScenarioResult(
        "running",
        "Requesting heading without location permission"
      )
    );

    try {
      await getHeading();
      setResult(
        "denied",
        createScenarioResult(
          "failed",
          "Permission-denied heading unexpectedly resolved."
        )
      );
    } catch (error) {
      try {
        const locationError = assertLocationErrorCode(
          error,
          LocationErrorCode.PERMISSION_DENIED
        );
        setResult(
          "denied",
          createScenarioResult(
            "passed",
            `${locationError.name}: heading follows native permission checks.`
          )
        );
      } catch (assertionError) {
        setResult(
          "denied",
          createScenarioResult("failed", getDisplayErrorMessage(assertionError))
        );
      }
    } finally {
      await refreshPermission();
    }
  };

  return (
    <ScenarioScreen
      prefix={PREFIX}
      title="Heading"
      subtitle="Compass-style heading contract with watch and rejection paths"
    >
      <ScenarioSection index={1} title="Permission">
        <PermissionStatusBlock prefix={PREFIX} status={permissionStatus} />
      </ScenarioSection>

      <ScenarioSection index={2} title="Single Heading" divided>
        <ScenarioButton
          title="Get Heading"
          onPress={runGetHeadingScenario}
          testID={`${PREFIX}-run-current-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="current"
          label="Single heading"
          result={results.current}
        />
      </ScenarioSection>

      <ScenarioSection index={3} title="Heading Watch" divided>
        <ScenarioButton
          title="Watch Heading"
          onPress={runWatchHeadingScenario}
          color="#00897B"
          testID={`${PREFIX}-run-watch-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="watch"
          label="Heading watch"
          result={results.watch}
        />
      </ScenarioSection>

      <ScenarioSection index={4} title="Invalid Filter" divided>
        <ScenarioButton
          title="Run Invalid Filter"
          onPress={runInvalidFilterScenario}
          color="#D84315"
          testID={`${PREFIX}-run-invalid-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="invalid"
          label="Invalid filter"
          result={results.invalid}
        />
      </ScenarioSection>

      <ScenarioSection index={5} title="Permission Denied" divided>
        <ScenarioButton
          title="Run Denied Heading"
          onPress={runDeniedScenario}
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
