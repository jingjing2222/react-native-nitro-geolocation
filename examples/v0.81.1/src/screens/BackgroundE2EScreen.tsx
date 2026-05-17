import React, { useState } from "react";
import { Platform } from "react-native";
import {
  addGeofences,
  checkBackgroundPermission,
  configureBackgroundLocation,
  getBackgroundLocationStatus,
  getRegisteredGeofences,
  getStoredBackgroundEvents,
  getStoredBackgroundLocations,
  requestBackgroundPermission,
  startBackgroundLocation,
  stopBackgroundLocation,
  syncStoredLocations
} from "react-native-nitro-geolocation/background";
import {
  ButtonRow,
  ResultList,
  ScenarioButton,
  ScenarioScreen,
  ScenarioSection,
  StatusBlock,
  createScenarioResult,
  createScenarioResults,
  sharedStyles,
  useScenarioResults
} from "./scenario";

const initialResults = createScenarioResults([
  "permission",
  "missingNotification",
  "configure",
  "startStop",
  "geofence",
  "storage",
  "sync"
] as const);

const validOptions = {
  trackingMode: "activityAware" as const,
  interval: 10_000,
  fastestInterval: 5_000,
  distanceFilter: 25,
  persist: true,
  maxStoredLocations: 10_000,
  maxStoredEvents: 10_000,
  stopOnTerminate: false,
  startOnBoot: true,
  android: {
    foregroundService: {
      notificationTitle: "Background tracking active",
      notificationText: "Recording location updates for E2E validation",
      notificationChannelId: "nitro-background-location-e2e",
      notificationChannelName: "Nitro Background Location E2E"
    }
  },
  ios: {
    pausesLocationUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true
  },
  activityRecognition: {
    enabled: true,
    interval: 10_000,
    stopOnStill: true,
    minimumConfidence: 70
  }
};

const shortError = (error: any) =>
  String(error?.message ?? error)
    .split("\n")[0]
    .slice(0, 140);

export default function BackgroundE2EScreen() {
  const { results, setResult, resetResults } =
    useScenarioResults(initialResults);
  const [status, setStatus] = useState("not checked");
  const [counts, setCounts] = useState({
    locations: 0,
    events: 0,
    geofences: 0
  });

  const refreshStatus = async () => {
    const current = await getBackgroundLocationStatus();
    setStatus(
      `${current.state} / fg=${current.foregroundPermission} / bg=${current.backgroundPermission}`
    );
    setCounts({
      locations: current.storedLocationCount,
      events: current.storedEventCount,
      geofences: current.geofenceCount
    });
  };

  const runPermission = async () => {
    setResult(
      "permission",
      createScenarioResult("running", "Checking native permission")
    );
    try {
      const before = await checkBackgroundPermission();
      const after = await requestBackgroundPermission();
      setResult(
        "permission",
        createScenarioResult(
          "passed",
          `foreground=${after.foreground}, background=${after.background}, before=${before.background}`
        )
      );
      await refreshStatus();
    } catch (error: any) {
      setResult(
        "permission",
        createScenarioResult("failed", error?.message ?? String(error))
      );
    }
  };

  const runMissingNotificationFailure = async () => {
    setResult(
      "missingNotification",
      createScenarioResult("running", "Starting with invalid Android config")
    );
    if (Platform.OS !== "android") {
      setResult(
        "missingNotification",
        createScenarioResult("passed", "Android-only validation skipped on iOS")
      );
      return;
    }

    try {
      await startBackgroundLocation({
        persist: true,
        android: {} as any
      });
      setResult(
        "missingNotification",
        createScenarioResult(
          "failed",
          "Invalid Android config unexpectedly started"
        )
      );
    } catch (error: any) {
      setResult(
        "missingNotification",
        createScenarioResult("passed", shortError(error))
      );
    }
  };

  const runConfigure = async () => {
    setResult(
      "configure",
      createScenarioResult("running", "Configuring background subsystem")
    );
    try {
      await configureBackgroundLocation(validOptions);
      await refreshStatus();
      setResult(
        "configure",
        createScenarioResult("passed", "Configuration persisted")
      );
    } catch (error: any) {
      setResult(
        "configure",
        createScenarioResult("failed", error?.message ?? String(error))
      );
    }
  };

  const runStartStop = async () => {
    setResult(
      "startStop",
      createScenarioResult("running", "Starting then stopping tracking")
    );
    try {
      await configureBackgroundLocation(validOptions);
      await startBackgroundLocation(validOptions);
      await stopBackgroundLocation();
      await refreshStatus();
      setResult(
        "startStop",
        createScenarioResult("passed", "Start/stop contract completed")
      );
    } catch (error: any) {
      setResult("startStop", createScenarioResult("failed", shortError(error)));
    }
  };

  const runGeofence = async () => {
    setResult(
      "geofence",
      createScenarioResult("running", "Registering office geofence")
    );
    try {
      await addGeofences([
        {
          identifier: "office",
          latitude: 37.5665,
          longitude: 126.978,
          radius: 150,
          notifyOnEntry: true,
          notifyOnExit: true,
          metadata: {
            kind: "workplace"
          }
        }
      ]);
      const registered = await getRegisteredGeofences();
      await refreshStatus();
      setResult(
        "geofence",
        createScenarioResult(
          "passed",
          `Registered ${registered.length} geofence(s)`
        )
      );
    } catch (error: any) {
      setResult(
        "geofence",
        createScenarioResult("failed", error?.message ?? String(error))
      );
    }
  };

  const runStorage = async () => {
    setResult(
      "storage",
      createScenarioResult("running", "Reading native recovery queues")
    );
    try {
      const locations = await getStoredBackgroundLocations({ limit: 10 });
      const events = await getStoredBackgroundEvents({ limit: 10 });
      setCounts((previous) => ({
        ...previous,
        locations: locations.length,
        events: events.length
      }));
      setResult(
        "storage",
        createScenarioResult(
          "passed",
          `Recovered ${locations.length} locations and ${events.length} events`
        )
      );
    } catch (error: any) {
      setResult(
        "storage",
        createScenarioResult("failed", error?.message ?? String(error))
      );
    }
  };

  const runSync = async () => {
    setResult(
      "sync",
      createScenarioResult("running", "Running native sync queue")
    );
    try {
      const result = await syncStoredLocations();
      setResult(
        "sync",
        createScenarioResult(
          result.success ? "passed" : "failed",
          `synced=${result.syncedLocationIds.length}, failed=${result.failedLocationIds.length}`
        )
      );
    } catch (error: any) {
      setResult(
        "sync",
        createScenarioResult("failed", error?.message ?? String(error))
      );
    }
  };

  const runHappyPath = async () => {
    await runConfigure();
    await runStartStop();
    await runGeofence();
    await runStorage();
    await runSync();
  };

  return (
    <ScenarioScreen
      prefix="background-e2e"
      title="Background Location E2E"
      subtitle="Success and failure cases for background subsystem"
    >
      <ScenarioSection
        index={1}
        title="Current Background Status"
        description="Native status and persisted queue counts"
      >
        <StatusBlock
          testID="background-e2e-status-card"
          rows={[
            {
              label: "Status:",
              value: status,
              testID: "background-e2e-status"
            },
            {
              label: "Locations:",
              value: counts.locations,
              testID: "background-e2e-location-count"
            },
            {
              label: "Events:",
              value: counts.events,
              testID: "background-e2e-event-count"
            },
            {
              label: "Geofences:",
              value: counts.geofences,
              testID: "background-e2e-geofence-count"
            }
          ]}
        />
        <ButtonRow>
          <ScenarioButton
            title="Refresh"
            onPress={refreshStatus}
            testID="background-e2e-refresh-button"
            containerStyle={sharedStyles.button}
          />
          <ScenarioButton
            title="Reset Results"
            onPress={resetResults}
            color="#6B7280"
            testID="background-e2e-reset-results-button"
            containerStyle={sharedStyles.button}
          />
        </ButtonRow>
      </ScenarioSection>

      <ScenarioSection
        index={2}
        title="Permission and Validation"
        description="Permission request plus required Android notification failure"
        divided
      >
        <ButtonRow>
          <ScenarioButton
            title="Run Permission"
            onPress={runPermission}
            testID="background-e2e-permission-button"
            containerStyle={sharedStyles.button}
          />
          <ScenarioButton
            title="Run Invalid Config"
            onPress={runMissingNotificationFailure}
            color="#B91C1C"
            testID="background-e2e-invalid-config-button"
            containerStyle={sharedStyles.button}
          />
        </ButtonRow>
        <ScenarioButton
          title="Run Happy Path"
          onPress={runHappyPath}
          testID="background-e2e-happy-path-button"
        />
        <ResultList
          prefix="background-e2e"
          results={results}
          items={[
            { id: "permission", label: "Permission" },
            {
              id: "missing-notification",
              resultKey: "missingNotification",
              label: "Missing notification"
            }
          ]}
        />
      </ScenarioSection>

      <ScenarioSection
        index={3}
        title="Tracking, Geofence, Storage, Sync"
        description="Configured background use cases and recovery APIs"
        divided
      >
        <ScenarioButton
          title="Configure Background"
          onPress={runConfigure}
          testID="background-e2e-configure-button"
        />
        <ScenarioButton
          title="Start Stop Tracking"
          onPress={runStartStop}
          testID="background-e2e-start-stop-button"
        />
        <ScenarioButton
          title="Register Geofence"
          onPress={runGeofence}
          testID="background-e2e-geofence-button"
        />
        <ScenarioButton
          title="Recover Stored Events"
          onPress={runStorage}
          testID="background-e2e-storage-button"
        />
        <ScenarioButton
          title="Run Native Sync"
          onPress={runSync}
          testID="background-e2e-sync-button"
        />
        <ResultList
          prefix="background-e2e"
          results={results}
          items={[
            { id: "configure", label: "Configure" },
            { id: "start-stop", resultKey: "startStop", label: "Start stop" },
            { id: "geofence", label: "Geofence" },
            { id: "storage", label: "Storage" },
            { id: "sync", label: "Sync" }
          ]}
        />
      </ScenarioSection>
    </ScenarioScreen>
  );
}
