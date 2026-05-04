import React, { useEffect, useState } from "react";
import { Button, Platform, ScrollView, Text, View } from "react-native";
import {
  LocationErrorCode,
  checkPermission,
  getCurrentPosition,
  requestPermission,
  unwatch,
  watchPosition
} from "react-native-nitro-geolocation";
import type {
  GeolocationResponse,
  LocationRequestOptions
} from "react-native-nitro-geolocation";
import {
  ResultBlock,
  assertFixtureCoordinates,
  assertLocationErrorCode,
  createIdleResult,
  getDisplayErrorMessage,
  runWithNativeGeolocation,
  sharedStyles
} from "./scenarioUtils";
import type { ScenarioResult } from "./scenarioUtils";

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

const initialResults = {
  tuned: createIdleResult(),
  invalid: createIdleResult(),
  denied: createIdleResult()
};

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

  useEffect(() => {
    refreshPermission();
  }, []);

  return (
    <ScrollView style={sharedStyles.container} testID={`${PREFIX}-screen`}>
      <View style={sharedStyles.header}>
        <Text style={sharedStyles.title}>iOS Location Tuning</Text>
        <Text style={sharedStyles.subtitle}>
          Native iOS manager configuration contract
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
        <Text style={sharedStyles.sectionTitle}>2. Tuned Requests</Text>
        <View style={sharedStyles.buttonContainer}>
          <Button
            title="Run Tuned Requests"
            onPress={runTunedRequestScenario}
            color="#1976D2"
            testID={`${PREFIX}-run-tuned-button`}
          />
        </View>
        <ResultBlock
          prefix={PREFIX}
          id="tuned"
          label="Tuned requests"
          result={results.tuned}
        />
      </View>

      <View style={sharedStyles.divider} />

      <View style={sharedStyles.section}>
        <Text style={sharedStyles.sectionTitle}>3. Invalid Activity Type</Text>
        <View style={sharedStyles.buttonContainer}>
          <Button
            title="Run Invalid Activity Type"
            onPress={runInvalidActivityTypeScenario}
            color="#D84315"
            testID={`${PREFIX}-run-invalid-button`}
          />
        </View>
        <ResultBlock
          prefix={PREFIX}
          id="invalid"
          label="Invalid activityType"
          result={results.invalid}
        />
      </View>

      <View style={sharedStyles.divider} />

      <View style={sharedStyles.section}>
        <Text style={sharedStyles.sectionTitle}>4. Permission Denied</Text>
        <View style={sharedStyles.buttonContainer}>
          <Button
            title="Run Denied Tuned Request"
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
