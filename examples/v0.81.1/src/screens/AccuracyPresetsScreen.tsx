import React, { useState } from "react";
import { Platform } from "react-native";
import {
  LocationErrorCode,
  getCurrentPosition
} from "react-native-nitro-geolocation";
import type {
  GeolocationResponse,
  LocationRequestOptions
} from "react-native-nitro-geolocation";
import {
  FixtureMismatchError,
  PermissionStatusBlock,
  ResultBlock,
  ScenarioButton,
  ScenarioMessageList,
  ScenarioScreen,
  ScenarioSection,
  assertFixtureCoordinates,
  captureLocationError,
  createScenarioResults,
  getDisplayErrorMessage,
  runWithNativeGeolocation,
  usePermissionStatus,
  useScenarioResults
} from "./scenario";

type AccuracyScenario = {
  id: string;
  title: string;
  options: LocationRequestOptions;
  assertPosition?: (position: GeolocationResponse) => string;
};

type PositiveScenarioMessage = {
  id: string;
  title: string;
  message: string;
};

const FIXTURE_RETRY_TIMEOUT_MS = Platform.OS === "ios" ? 90000 : 25000;
const FIXTURE_RETRY_INTERVAL_MS = 1000;
const IOS_REQUEST_TIMEOUT_MS = 30000;

const initialResults = createScenarioResults([
  "positive",
  "invalid",
  "denied"
] as const);

const isFixtureMismatchError = (
  error: unknown
): error is FixtureMismatchError => {
  return error instanceof Error && error.name === "FixtureMismatchError";
};

const isRetryableLocationError = (error: unknown) => {
  if (isFixtureMismatchError(error)) {
    return true;
  }

  return captureLocationError(error).code === LocationErrorCode.TIMEOUT;
};

const sleep = (durationMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(() => resolve(), durationMs);
  });

const runScenarioWithSettledFixture = async (
  scenario: AccuracyScenario
): Promise<string> => {
  const deadline = Date.now() + FIXTURE_RETRY_TIMEOUT_MS;
  let lastRetryableError: Error | null = null;
  let attempt = 0;

  while (Date.now() <= deadline) {
    attempt += 1;

    try {
      const position = await runWithNativeGeolocation(() =>
        getCurrentPosition(scenario.options)
      );

      return scenario.assertPosition
        ? scenario.assertPosition(position)
        : assertFixtureCoordinates(position);
    } catch (error) {
      if (!isRetryableLocationError(error)) {
        throw error;
      }

      const message = getDisplayErrorMessage(error);
      lastRetryableError = new Error(`${message} Attempt ${attempt}.`);
      await sleep(FIXTURE_RETRY_INTERVAL_MS);
    }
  }

  throw (
    lastRetryableError ??
    new FixtureMismatchError("Injected fixture location was not observed.")
  );
};

const getPositiveScenarios = (): AccuracyScenario[] => {
  if (Platform.OS === "android") {
    return [
      {
        id: "android-high-overrides-false",
        title: "Android high overrides enableHighAccuracy=false",
        options: {
          enableHighAccuracy: false,
          accuracy: {
            android: "high"
          },
          maximumAge: 0,
          timeout: 15000
        }
      },
      {
        id: "android-balanced-overrides-true",
        title: "Android balanced overrides enableHighAccuracy=true",
        options: {
          enableHighAccuracy: true,
          accuracy: {
            android: "balanced"
          },
          maximumAge: 0,
          timeout: 15000
        }
      },
      {
        id: "android-low-overrides-true",
        title: "Android low overrides enableHighAccuracy=true",
        options: {
          enableHighAccuracy: true,
          accuracy: {
            android: "low"
          },
          maximumAge: 0,
          timeout: 15000
        }
      }
    ];
  }

  return [
    {
      id: "ios-best-navigation-overrides-false",
      title: "iOS bestForNavigation overrides enableHighAccuracy=false",
      options: {
        enableHighAccuracy: false,
        accuracy: {
          ios: "bestForNavigation"
        },
        activityType: "otherNavigation",
        maximumAge: 0,
        pausesLocationUpdatesAutomatically: false,
        timeout: IOS_REQUEST_TIMEOUT_MS
      }
    },
    {
      id: "ios-nearest-ten",
      title: "iOS nearestTenMeters returns fixture coordinates",
      options: {
        accuracy: {
          ios: "nearestTenMeters"
        },
        activityType: "otherNavigation",
        maximumAge: 0,
        pausesLocationUpdatesAutomatically: false,
        timeout: IOS_REQUEST_TIMEOUT_MS
      }
    },
    {
      id: "ios-reduced-overrides-true",
      title: "iOS reduced overrides enableHighAccuracy=true",
      options: {
        enableHighAccuracy: true,
        accuracy: {
          ios: "reduced"
        },
        activityType: "otherNavigation",
        maximumAge: 0,
        pausesLocationUpdatesAutomatically: false,
        timeout: IOS_REQUEST_TIMEOUT_MS
      }
    }
  ];
};

export default function AccuracyPresetsScreen() {
  const {
    permissionStatus,
    requestLocationPermission: requestNativePermission,
    setPermissionStatus
  } = usePermissionStatus();
  const { results, setResult } = useScenarioResults(initialResults);
  const [scenarioMessages, setScenarioMessages] = useState<
    PositiveScenarioMessage[]
  >([]);

  const requestLocationPermission = async () => {
    try {
      return await requestNativePermission();
    } catch (error) {
      const message = getDisplayErrorMessage(error);
      setPermissionStatus(message);
      return message;
    }
  };

  const runPositiveScenarios = async () => {
    setResult("positive", {
      status: "running",
      message: "Running native accuracy preset requests"
    });
    setScenarioMessages([]);

    try {
      const status = await requestLocationPermission();
      if (status !== "granted") {
        throw new Error(`Permission was not granted: ${status}`);
      }

      const messages: PositiveScenarioMessage[] = [];
      for (const scenario of getPositiveScenarios()) {
        const summary = await runScenarioWithSettledFixture(scenario);
        messages.push({
          id: scenario.id,
          title: scenario.title,
          message: `contract passed with injected location ${summary}`
        });
      }

      setScenarioMessages(messages);
      setResult("positive", {
        status: "passed",
        message: `${messages.length} accuracy preset contracts passed.`
      });
    } catch (error) {
      setResult("positive", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    }
  };

  const runInvalidPresetScenario = async () => {
    setResult("invalid", {
      status: "running",
      message: "Calling native API with an invalid preset"
    });

    const invalidOptions = {
      accuracy:
        Platform.OS === "android" ? { android: "ultra" } : { ios: "cityBlock" },
      maximumAge: 0,
      timeout: 15000
    } as unknown as LocationRequestOptions;

    try {
      await runWithNativeGeolocation(() => getCurrentPosition(invalidOptions));
      setResult("invalid", {
        status: "failed",
        message: "Invalid preset unexpectedly resolved."
      });
    } catch (error) {
      setResult("invalid", {
        status: "passed",
        message: getDisplayErrorMessage(error)
      });
    }
  };

  const runPermissionDeniedScenario = async () => {
    setResult("denied", {
      status: "running",
      message: "Calling native API without location permission"
    });

    const options: LocationRequestOptions =
      Platform.OS === "android"
        ? {
            accuracy: {
              android: "balanced"
            },
            timeout: 5000
          }
        : {
            accuracy: {
              ios: "best"
            },
            timeout: 5000
          };

    try {
      await runWithNativeGeolocation(() => getCurrentPosition(options));
      setResult("denied", {
        status: "failed",
        message: "Permission-denied request unexpectedly resolved."
      });
    } catch (error) {
      const maybeError = error as { code?: unknown };
      const code =
        typeof maybeError.code === "number"
          ? maybeError.code
          : LocationErrorCode.INTERNAL_ERROR;

      setResult("denied", {
        status:
          code === LocationErrorCode.PERMISSION_DENIED ? "passed" : "failed",
        message: getDisplayErrorMessage(error)
      });
    }
  };

  return (
    <ScenarioScreen
      prefix="accuracy-presets"
      title="Accuracy Presets"
      subtitle="Native request contract for platform accuracy options"
    >
      <ScenarioSection index={1} title="Permission">
        <PermissionStatusBlock
          prefix="accuracy-presets"
          status={permissionStatus}
        />
        <ScenarioButton
          title="Request Permission"
          onPress={requestLocationPermission}
          color="#4CAF50"
          testID="accuracy-presets-request-permission-button"
        />
      </ScenarioSection>

      <ScenarioSection index={2} title="Positive Presets" divided>
        <ScenarioButton
          title="Run Preset Requests"
          onPress={runPositiveScenarios}
          testID="accuracy-presets-run-positive-button"
        />
        <ResultBlock
          prefix="accuracy-presets"
          id="positive"
          label="Positive presets"
          result={results.positive}
        />
        <ScenarioMessageList
          prefix="accuracy-presets"
          messages={scenarioMessages}
        />
      </ScenarioSection>

      <ScenarioSection index={3} title="Invalid Preset" divided>
        <ScenarioButton
          title="Run Invalid Preset"
          onPress={runInvalidPresetScenario}
          color="#D84315"
          testID="accuracy-presets-run-invalid-button"
        />
        <ResultBlock
          prefix="accuracy-presets"
          id="invalid"
          label="Invalid preset"
          result={results.invalid}
        />
      </ScenarioSection>

      <ScenarioSection index={4} title="Permission Denied" divided>
        <ScenarioButton
          title="Run Denied Request"
          onPress={runPermissionDeniedScenario}
          color="#7B1FA2"
          testID="accuracy-presets-run-denied-button"
        />
        <ResultBlock
          prefix="accuracy-presets"
          id="denied"
          label="Permission denied"
          result={results.denied}
        />
      </ScenarioSection>
    </ScenarioScreen>
  );
}
