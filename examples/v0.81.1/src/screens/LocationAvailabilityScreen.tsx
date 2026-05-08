import React from "react";
import { Platform } from "react-native";
import {
  LocationErrorCode,
  getCurrentPosition,
  getLocationAvailability,
  setConfiguration
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

const PREFIX = "location-availability";

const initialResults = createScenarioResults(["available", "denied"] as const);

export default function LocationAvailabilityScreen() {
  const { permissionStatus, refreshPermission, requestLocationPermission } =
    usePermissionStatus();
  const { results, setResult } = useScenarioResults(initialResults);

  const runAvailableScenario = async () => {
    setResult("available", {
      status: "running",
      message: "Seeding a real native position before checking availability"
    });

    try {
      const permission = await requestLocationPermission();
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

  return (
    <ScenarioScreen
      prefix={PREFIX}
      title="Location Availability"
      subtitle="Availability contract tied to native fixes and permission failures"
    >
      <ScenarioSection index={1} title="Permission">
        <PermissionStatusBlock prefix={PREFIX} status={permissionStatus} />
      </ScenarioSection>

      <ScenarioSection index={2} title="Native Availability" divided>
        <ScenarioButton
          title="Check After Native Fix"
          onPress={runAvailableScenario}
          testID={`${PREFIX}-run-available-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="available"
          label="Availability"
          result={results.available}
        />
      </ScenarioSection>

      <ScenarioSection index={3} title="Permission Denied" divided>
        <ScenarioButton
          title="Run Denied Availability"
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
