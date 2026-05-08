import React from "react";
import { Platform } from "react-native";
import {
  LocationErrorCode,
  getCurrentPosition,
  unwatch,
  watchPosition
} from "react-native-nitro-geolocation";
import type {
  GeolocationResponse,
  LocationRequestOptions
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

const PREFIX = "ios-location-tuning";

const tunedOptions: LocationRequestOptions = {
  accuracy: {
    ios: "kilometer"
  },
  activityType: "fitness",
  maximumAge: 0,
  pausesLocationUpdatesAutomatically: false,
  showsBackgroundLocationIndicator: false,
  timeout: 15000
};

const initialResults = createScenarioResults([
  "tuned",
  "invalid",
  "denied"
] as const);

const waitForWatchPosition = (options: LocationRequestOptions) =>
  new Promise<GeolocationResponse>((resolve, reject) => {
    let token: string | null = null;
    const timeout = setTimeout(() => {
      if (token) {
        unwatch(token);
      }
      reject(new Error("watchPosition did not emit within 15000ms."));
    }, 15000);

    token = watchPosition(
      (position) => {
        clearTimeout(timeout);
        if (token) {
          unwatch(token);
        }
        resolve(position);
      },
      (error) => {
        clearTimeout(timeout);
        if (token) {
          unwatch(token);
        }
        reject(error);
      },
      options
    );
  });

export default function IOSLocationTuningScreen() {
  const { permissionStatus, refreshPermission, requestLocationPermission } =
    usePermissionStatus();
  const { results, setResult } = useScenarioResults(initialResults);

  const ensureIOS = () => {
    if (Platform.OS !== "ios") {
      throw new Error("This contract is iOS-only.");
    }
  };

  const runTunedRequestScenario = async () => {
    setResult("tuned", {
      status: "running",
      message: "Running current and watch requests with iOS tuning options"
    });

    try {
      ensureIOS();
      const status = await requestLocationPermission();
      if (status !== "granted") {
        throw new Error(`Permission was not granted: ${status}`);
      }

      const current = await runWithNativeGeolocation(() =>
        getCurrentPosition(tunedOptions)
      );
      const currentCoordinates = assertFixtureCoordinates(current);
      const watched = await runWithNativeGeolocation(() =>
        waitForWatchPosition({
          ...tunedOptions,
          distanceFilter: 0
        })
      );
      const watchedCoordinates = assertFixtureCoordinates(watched);

      setResult("tuned", {
        status: "passed",
        message: `activityType=fitness, pauses=false, backgroundIndicator=false, accuracy=kilometer returned current ${currentCoordinates} and watch ${watchedCoordinates}.`
      });
    } catch (error) {
      setResult("tuned", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      await refreshPermission();
    }
  };

  const runInvalidActivityTypeScenario = async () => {
    setResult("invalid", {
      status: "running",
      message: "Calling native request with an invalid iOS activity type"
    });

    const invalidOptions = {
      ...tunedOptions,
      activityType: "stationary"
    } as unknown as LocationRequestOptions;

    try {
      ensureIOS();
      await runWithNativeGeolocation(() => getCurrentPosition(invalidOptions));
      setResult("invalid", {
        status: "failed",
        message: "Invalid iOS activityType unexpectedly resolved."
      });
    } catch (error) {
      const message = getDisplayErrorMessage(error);
      setResult("invalid", {
        status:
          message.includes("IOSActivityType") ||
          message.includes("activityType") ||
          message.includes("invalid value")
            ? "passed"
            : "failed",
        message
      });
    }
  };

  const runPermissionDeniedScenario = async () => {
    setResult("denied", {
      status: "running",
      message: "Calling tuned request without permission"
    });

    try {
      ensureIOS();
      await runWithNativeGeolocation(() => getCurrentPosition(tunedOptions));
      setResult("denied", {
        status: "failed",
        message: "Permission-denied tuned request unexpectedly resolved."
      });
    } catch (error) {
      try {
        const locationError = assertLocationErrorCode(
          error,
          LocationErrorCode.PERMISSION_DENIED
        );
        setResult("denied", {
          status: "passed",
          message: `${locationError.name}: iOS tuning options did not bypass permission checks.`
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
      title="iOS Location Tuning"
      subtitle="Native iOS manager configuration contract"
    >
      <ScenarioSection index={1} title="Permission">
        <PermissionStatusBlock prefix={PREFIX} status={permissionStatus} />
      </ScenarioSection>

      <ScenarioSection index={2} title="Tuned Requests" divided>
        <ScenarioButton
          title="Run Tuned Requests"
          onPress={runTunedRequestScenario}
          testID={`${PREFIX}-run-tuned-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="tuned"
          label="Tuned requests"
          result={results.tuned}
        />
      </ScenarioSection>

      <ScenarioSection index={3} title="Invalid Activity Type" divided>
        <ScenarioButton
          title="Run Invalid Activity Type"
          onPress={runInvalidActivityTypeScenario}
          color="#D84315"
          testID={`${PREFIX}-run-invalid-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="invalid"
          label="Invalid activityType"
          result={results.invalid}
        />
      </ScenarioSection>

      <ScenarioSection index={4} title="Permission Denied" divided>
        <ScenarioButton
          title="Run Denied Tuned Request"
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
