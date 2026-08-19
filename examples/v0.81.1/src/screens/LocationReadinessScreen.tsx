import React from "react";
import { Platform } from "react-native";
import {
  type LocationReadiness,
  getCurrentPosition,
  getLocationReadiness
} from "react-native-nitro-geolocation";
import {
  PermissionStatusBlock,
  ResultBlock,
  ScenarioButton,
  ScenarioScreen,
  ScenarioSection,
  assertFixtureCoordinates,
  createScenarioResults,
  getDisplayErrorMessage,
  runWithNativeGeolocation,
  usePermissionStatus,
  useScenarioResults
} from "./scenario";

const PREFIX = "location-readiness";
const initialResults = createScenarioResults([
  "ready",
  "denied",
  "servicesDisabled"
] as const);

const summarize = (readiness: LocationReadiness) => {
  const remediations = readiness.remediations.join(",") || "none";
  return `ready=${String(readiness.ready)}; permission=${readiness.permission}; services=${String(readiness.providerStatus.locationServicesEnabled)}; available=${String(readiness.availability.available)}; cache=${String(readiness.cache.available)}; remediations=${remediations}`;
};

export default function LocationReadinessScreen() {
  const { permissionStatus, refreshPermission, requestLocationPermission } =
    usePermissionStatus();
  const { results, setResult } = useScenarioResults(initialResults);

  const runReadyScenario = async () => {
    setResult("ready", {
      status: "running",
      message:
        "Requesting permission and observing a real position before diagnosis"
    });

    try {
      const permission = await requestLocationPermission();
      if (permission !== "granted") {
        throw new Error(`Permission was not granted: ${permission}`);
      }

      const position = await runWithNativeGeolocation(() =>
        getCurrentPosition({
          accuracy: { android: "high", ios: "best" },
          maximumAge: 0,
          timeout: 15000
        })
      );
      const coordinates = assertFixtureCoordinates(position);
      const readiness = await getLocationReadiness();

      if (!readiness.ready) {
        throw new Error(`Expected ready diagnosis; ${summarize(readiness)}`);
      }
      if (!readiness.cache.available) {
        throw new Error("Expected the observed position in the module cache.");
      }
      if (readiness.remediations.length > 0) {
        throw new Error(
          `Ready diagnosis returned remediations: ${readiness.remediations.join(",")}`
        );
      }

      setResult("ready", {
        status: "passed",
        message: `Read-only diagnosis confirmed ${coordinates}; ${summarize(readiness)}`
      });
    } catch (error) {
      setResult("ready", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      await refreshPermission();
    }
  };

  const runDeniedScenario = async () => {
    const expectedRemediation =
      Platform.OS === "android"
        ? "requestPermission"
        : "reviewPermissionSettings";
    setResult("denied", {
      status: "running",
      message: "Reading missing permission state without opening a prompt"
    });

    try {
      const readiness = await getLocationReadiness();
      if (readiness.ready || readiness.permission === "granted") {
        throw new Error(`Expected denied diagnosis; ${summarize(readiness)}`);
      }
      if (!readiness.remediations.includes(expectedRemediation)) {
        throw new Error(
          `Expected ${expectedRemediation}; ${summarize(readiness)}`
        );
      }

      setResult("denied", {
        status: "passed",
        message: `Missing permission was diagnosed without prompting; ${summarize(readiness)}`
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

  const runServicesDisabledScenario = async () => {
    setResult("servicesDisabled", {
      status: "running",
      message: "Reading device service state without opening settings"
    });

    try {
      const readiness = await getLocationReadiness();
      if (readiness.ready || readiness.providerStatus.locationServicesEnabled) {
        throw new Error(
          `Expected disabled location services; ${summarize(readiness)}`
        );
      }
      if (!readiness.remediations.includes("enableLocationServices")) {
        throw new Error(
          `Expected enableLocationServices; ${summarize(readiness)}`
        );
      }

      setResult("servicesDisabled", {
        status: "passed",
        message: `Disabled services were diagnosed without opening settings; ${summarize(readiness)}`
      });
    } catch (error) {
      setResult("servicesDisabled", {
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
      title="Location Readiness"
      subtitle="Read-only permission, services, provider, Play Services, and cache diagnosis"
    >
      <ScenarioSection index={1} title="Permission">
        <PermissionStatusBlock prefix={PREFIX} status={permissionStatus} />
      </ScenarioSection>

      <ScenarioSection index={2} title="Ready Device" divided>
        <ScenarioButton
          title="Seed Position and Diagnose"
          onPress={runReadyScenario}
          testID={`${PREFIX}-run-ready-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="ready"
          label="Ready diagnosis"
          result={results.ready}
        />
      </ScenarioSection>

      <ScenarioSection index={3} title="Missing Permission" divided>
        <ScenarioButton
          title="Diagnose Missing Permission"
          onPress={runDeniedScenario}
          color="#7B1FA2"
          testID={`${PREFIX}-run-denied-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="denied"
          label="Permission diagnosis"
          result={results.denied}
        />
      </ScenarioSection>

      <ScenarioSection index={4} title="Services Disabled" divided>
        <ScenarioButton
          title="Diagnose Disabled Services"
          onPress={runServicesDisabledScenario}
          color="#C62828"
          testID={`${PREFIX}-run-services-disabled-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="services-disabled"
          label="Services disabled diagnosis"
          result={results.servicesDisabled}
        />
      </ScenarioSection>
    </ScenarioScreen>
  );
}
