import React, { useEffect, useState } from "react";
import { Linking, Platform } from "react-native";
import {
  getAccuracyAuthorization,
  getCurrentPosition,
  getProviderStatus,
  setConfiguration
} from "react-native-nitro-geolocation";
import type {
  AccuracyAuthorization,
  LocationProviderStatus
} from "react-native-nitro-geolocation";
import {
  DumpedText,
  PermissionStatusBlock,
  ResultList,
  ScenarioButton,
  ScenarioScreen,
  ScenarioSection,
  StatusBlock,
  createScenarioResults,
  getDisplayErrorMessage,
  runWithNativeGeolocation,
  sharedStyles,
  usePermissionStatus,
  useScenarioResults
} from "./scenario";

const PREFIX = "gps-offline";
const GPS_REQUEST_TIMEOUT_MS = 45_000;
const resultsInitialState = createScenarioResults([
  "readiness",
  "request"
] as const);

type GpsReadiness = "checking" | "ready" | "unavailable";

const formatAvailability = (value: boolean | undefined) => {
  if (value === undefined) return "unknown";
  return value ? "available" : "unavailable";
};

export default function GpsOfflineRecipeScreen() {
  const { permissionStatus, refreshPermission, requestLocationPermission } =
    usePermissionStatus({ autoRefresh: false });
  const { results, setResult } = useScenarioResults(resultsInitialState);
  const [providerStatus, setProviderStatus] =
    useState<LocationProviderStatus | null>(null);
  const [accuracyAuthorization, setAccuracyAuthorization] =
    useState<AccuracyAuthorization>("unknown");
  const [readiness, setReadiness] = useState<GpsReadiness>("checking");
  const [isBusy, setIsBusy] = useState(false);

  const checkReadiness = async () => {
    setIsBusy(true);
    setReadiness("checking");
    setResult("readiness", {
      status: "running",
      message: "Checking permission, location services, and GPS availability"
    });

    try {
      if (Platform.OS !== "android") {
        setReadiness("unavailable");
        setResult("readiness", {
          status: "passed",
          message:
            "GPS recipe: unsupported; iOS Core Location does not expose sensor routing."
        });
        return;
      }

      const [permission, accuracy, status] = await Promise.all([
        refreshPermission(),
        getAccuracyAuthorization(),
        getProviderStatus()
      ]);
      setAccuracyAuthorization(accuracy);
      setProviderStatus(status);

      const isReady =
        permission === "granted" &&
        accuracy === "full" &&
        status.locationServicesEnabled &&
        status.gpsAvailable === true;
      setReadiness(isReady ? "ready" : "unavailable");
      setResult("readiness", {
        status: "passed",
        message: `GPS recipe: ${isReady ? "ready" : "unavailable"}; locationServices=${status.locationServicesEnabled}; gps=${status.gpsAvailable ?? "unknown"}; permission=${permission}; accuracy=${accuracy}.`
      });
    } catch (error) {
      setReadiness("unavailable");
      setResult("readiness", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      setIsBusy(false);
    }
  };

  const resolvePrecisePermission = async () => {
    setIsBusy(true);
    try {
      if (
        Platform.OS === "android" &&
        permissionStatus === "granted" &&
        accuracyAuthorization === "reduced"
      ) {
        await Linking.openSettings();
        return;
      }

      await requestLocationPermission();
      await checkReadiness();
    } catch (error) {
      setReadiness("unavailable");
      setResult("readiness", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      setIsBusy(false);
    }
  };

  const runGpsOnlyRequest = async () => {
    setIsBusy(true);
    setResult("request", {
      status: "running",
      message: "Requesting one fresh Android platform GPS fix"
    });

    try {
      if (Platform.OS !== "android") {
        throw new Error(
          "GPS-only sensor routing is Android-only; iOS Core Location chooses the source."
        );
      }

      const [permission, accuracy, status] = await Promise.all([
        refreshPermission(),
        getAccuracyAuthorization(),
        getProviderStatus()
      ]);
      setAccuracyAuthorization(accuracy);
      setProviderStatus(status);
      const isReady =
        permission === "granted" &&
        accuracy === "full" &&
        status.locationServicesEnabled &&
        status.gpsAvailable === true;
      setReadiness(isReady ? "ready" : "unavailable");
      setResult("readiness", {
        status: "passed",
        message: `GPS recipe: ${isReady ? "ready" : "unavailable"}; locationServices=${status.locationServicesEnabled}; gps=${status.gpsAvailable ?? "unknown"}; permission=${permission}; accuracy=${accuracy}.`
      });
      if (permission !== "granted") {
        throw new Error(
          `GPS-only result acceptance requires location permission; permission=${permission}.`
        );
      }
      if (accuracy !== "full") {
        throw new Error(
          `GPS-only result acceptance requires precise location permission; accuracy=${accuracy}.`
        );
      }
      if (!status.locationServicesEnabled || status.gpsAvailable !== true) {
        throw new Error(
          "GPS-only recipe requires Android location services and the GPS provider to be available."
        );
      }

      setConfiguration({ locationProvider: "android" });
      const startedAt = Date.now();
      const position = await runWithNativeGeolocation(() =>
        getCurrentPosition({
          accuracy: { android: "high" },
          granularity: "fine",
          maximumAge: 0,
          maxUpdateAge: 0,
          maxUpdateDelay: 0,
          timeout: GPS_REQUEST_TIMEOUT_MS
        })
      );

      if (position.provider !== "gps") {
        throw new Error(
          `GPS-only result contract rejected ${position.provider ?? "an unknown provider"}; the Android platform route may fall back, but this recipe never accepts that result.`
        );
      }
      if (position.timestamp < startedAt - 30_000) {
        throw new Error(
          `GPS-only request returned a stale fix from ${position.timestamp}.`
        );
      }
      if (typeof position.mocked !== "boolean") {
        throw new Error("Android GPS-only request did not report mock status.");
      }

      setResult("request", {
        status: "passed",
        message: `Fresh fix ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}; provider=${position.provider}; mocked=${position.mocked}; maximumAge=0.`
      });
    } catch (error) {
      setResult("request", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      setConfiguration({ locationProvider: "auto" });
      await refreshPermission();
      setIsBusy(false);
    }
  };

  useEffect(() => {
    void checkReadiness();
  }, []);

  return (
    <ScenarioScreen
      prefix={PREFIX}
      title="GPS-only / Offline Recipe"
      subtitle="Android GPS-preferred routing with GPS-only result acceptance"
    >
      <ScenarioSection
        index={1}
        title="Readiness"
        description="Network availability is informational. This recipe requires precise permission, location services, and the Android GPS provider."
      >
        <PermissionStatusBlock prefix={PREFIX} status={permissionStatus} />
        <StatusBlock
          testID="gps-offline-provider-status"
          rows={[
            {
              label: "Accuracy authorization:",
              value: accuracyAuthorization,
              testID: "gps-offline-accuracy-authorization"
            },
            {
              label: "Location services:",
              value: formatAvailability(
                providerStatus?.locationServicesEnabled
              ),
              testID: "gps-offline-location-services"
            },
            {
              label: "GPS:",
              value: formatAvailability(providerStatus?.gpsAvailable),
              testID: "gps-offline-gps"
            },
            {
              label: "Network provider:",
              value: formatAvailability(providerStatus?.networkAvailable),
              testID: "gps-offline-network"
            }
          ]}
        />
        <ResultList
          prefix={PREFIX}
          results={results}
          items={[
            {
              id: "readiness",
              label: "GPS readiness"
            }
          ]}
        />
        <ScenarioButton
          title={isBusy ? "Checking..." : "Check GPS Readiness"}
          onPress={checkReadiness}
          disabled={isBusy}
          color="#1565C0"
          testID="gps-offline-check-readiness-button"
        />
        {permissionStatus !== "granted" || accuracyAuthorization !== "full" ? (
          <ScenarioButton
            title={
              Platform.OS === "android" && permissionStatus === "granted"
                ? "Open App Settings for Precise Location"
                : "Request Location Permission"
            }
            onPress={resolvePrecisePermission}
            disabled={isBusy}
            color="#6A1B9A"
            testID="gps-offline-request-permission-button"
          />
        ) : null}
      </ScenarioSection>

      <ScenarioSection
        index={2}
        title="Fresh GPS Fix"
        description="Run the same explicit request online and offline. Android may try a fallback provider, but this recipe rejects every non-GPS result and never retries in secret."
        divided
      >
        {readiness !== "ready" ? (
          <DumpedText
            dumpText="GPS-only request is blocked until GPS readiness is ready."
            style={sharedStyles.resultMessage}
            testID="gps-offline-request-blocked"
          >
            GPS-only request is blocked until GPS readiness is ready.
          </DumpedText>
        ) : null}
        <ScenarioButton
          title={isBusy ? "Locating..." : "Run GPS-only Request"}
          onPress={runGpsOnlyRequest}
          disabled={isBusy || readiness !== "ready"}
          color="#2E7D32"
          testID="gps-offline-run-button"
        />
        <ResultList
          prefix={PREFIX}
          results={results}
          items={[
            {
              id: "request",
              label: "GPS-only request"
            }
          ]}
        />
      </ScenarioSection>
    </ScenarioScreen>
  );
}
