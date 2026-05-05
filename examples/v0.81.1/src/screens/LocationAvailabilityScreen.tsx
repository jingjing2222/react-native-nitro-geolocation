import React, { useEffect, useState } from "react";
import { Button, Platform, ScrollView, Text, View } from "react-native";
import {
  LocationErrorCode,
  checkPermission,
  getCurrentPosition,
  getLocationAvailability,
  requestPermission,
  setConfiguration
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

const PREFIX = "location-availability";

const initialResults = {
  available: createIdleResult(),
  denied: createIdleResult()
};

export default function LocationAvailabilityScreen() {
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

  const runAvailableScenario = async () => {
    setResult("available", {
      status: "running",
      message: "Seeding a real native position before checking availability"
    });

    try {
      const permission = await requestPermission();
      setPermissionStatus(permission);
      if (permission !== "granted") {
        throw new Error(`Permission was not granted: ${permission}`);
      }

      setConfiguration({
        locationProvider: Platform.OS === "android" ? "playServices" : "auto"
      });

      const position = await runWithNativeGeolocation(() =>
        getCurrentPosition({
          accuracy: {
            android: "high",
            ios: "best"
          },
          maximumAge: 0,
          timeout: 15000
        })
      );
      const coordinates = assertFixtureCoordinates(position);
      const availability = await getLocationAvailability();

      if (!availability.available) {
        throw new Error(
          `Expected location to be available after a native fix, reason=${availability.reason ?? "none"}`
        );
      }

      setResult("available", {
        status: "passed",
        message: `Availability was true after native fix ${coordinates}; reason=${availability.reason ?? "none"}.`
      });
    } catch (error) {
      setResult("available", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      await refreshPermission();
    }
  };

  const runDeniedScenario = async () => {
    setResult("denied", {
      status: "running",
      message: "Checking availability with location permission denied"
    });

    try {
      const availability = await getLocationAvailability();
      if (availability.available) {
        throw new Error("Availability unexpectedly resolved as available.");
      }

      if (availability.reason !== "permissionDenied") {
        throw new Error(
          `Expected permissionDenied reason, received ${availability.reason ?? "none"}.`
        );
      }

      try {
        await runWithNativeGeolocation(() =>
          getCurrentPosition({ maximumAge: 0, timeout: 5000 })
        );
        throw new Error("Denied getCurrentPosition unexpectedly resolved.");
      } catch (error) {
        assertLocationErrorCode(error, LocationErrorCode.PERMISSION_DENIED);
      }

      setResult("denied", {
        status: "passed",
        message:
          "permissionDenied availability matched the native request rejection."
      });
    } catch (error) {
      setResult("denied", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
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
        <Text style={sharedStyles.title}>Location Availability</Text>
        <Text style={sharedStyles.subtitle}>
          Availability contract tied to native fixes and permission failures
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
        <Text style={sharedStyles.sectionTitle}>2. Native Availability</Text>
        <View style={sharedStyles.buttonContainer}>
          <Button
            title="Check After Native Fix"
            onPress={runAvailableScenario}
            color="#1976D2"
            testID={`${PREFIX}-run-available-button`}
          />
        </View>
        <ResultBlock
          prefix={PREFIX}
          id="available"
          label="Availability"
          result={results.available}
        />
      </View>

      <View style={sharedStyles.divider} />

      <View style={sharedStyles.section}>
        <Text style={sharedStyles.sectionTitle}>3. Permission Denied</Text>
        <View style={sharedStyles.buttonContainer}>
          <Button
            title="Run Denied Availability"
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
