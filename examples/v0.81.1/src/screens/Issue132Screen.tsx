import React, { useRef, useState } from "react";
import { Platform } from "react-native";
import {
  type BackgroundLocationOptions,
  type BackgroundSubscription,
  clearStoredBackgroundEvents,
  clearStoredBackgroundLocations,
  getBackgroundLocationStatus,
  onBackgroundLocation,
  resetBackgroundLocation,
  startBackgroundLocation,
  stopBackgroundLocation
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

const PREFIX = "issue-132";

const initialResults = createScenarioResults(["foregroundListener"] as const);

const options: BackgroundLocationOptions = {
  trackingMode: "continuous",
  interval: 1_000,
  fastestInterval: 500,
  distanceFilter: 0,
  persist: false,
  stopOnTerminate: true,
  startOnBoot: false,
  android: {
    locationProvider: "android_platform",
    requestNotificationPermission: false,
    foregroundService: {
      notificationTitle: "Issue 132 foreground listener",
      notificationText: "Waiting for foreground-service location updates",
      notificationChannelId: "nitro-issue-132",
      notificationChannelName: "Nitro Issue 132"
    }
  }
};

const shortError = (error: unknown) =>
  String(error instanceof Error ? error.message : error)
    .split("\n")[0]
    .slice(0, 160);

export default function Issue132Screen() {
  const { results, setResult, resetResults } =
    useScenarioResults(initialResults);
  const subscriptionRef = useRef<BackgroundSubscription | undefined>(undefined);
  const updateCountRef = useRef(0);
  const [status, setStatus] = useState("not checked");
  const [liveUpdates, setLiveUpdates] = useState(0);

  const refreshStatus = async () => {
    const current = await getBackgroundLocationStatus();
    setStatus(
      `${current.state} / running=${String(current.isRunning)} / fgService=${String(
        current.android?.isForegroundServiceRunning ?? false
      )}`
    );
  };

  const removeListener = () => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = undefined;
  };

  const cleanup = async () => {
    removeListener();
    await stopBackgroundLocation().catch(() => undefined);
    await resetBackgroundLocation().catch(() => undefined);
    await refreshStatus().catch(() => undefined);
  };

  const runForegroundListener = async () => {
    setResult(
      "foregroundListener",
      createScenarioResult(
        "running",
        "Starting foreground-service tracking with only a live JS listener"
      )
    );

    if (Platform.OS !== "android") {
      setResult(
        "foregroundListener",
        createScenarioResult("passed", "Android-only warning repro skipped")
      );
      return;
    }

    try {
      await cleanup();
      await Promise.all([
        clearStoredBackgroundLocations(),
        clearStoredBackgroundEvents()
      ]);

      updateCountRef.current = 0;
      setLiveUpdates(0);
      subscriptionRef.current = onBackgroundLocation((location) => {
        updateCountRef.current += 1;
        setLiveUpdates(updateCountRef.current);
        setResult(
          "foregroundListener",
          createScenarioResult(
            "passed",
            `Live update ${updateCountRef.current} delivered at ${location.coords.latitude.toFixed(
              5
            )}, ${location.coords.longitude.toFixed(5)}`
          )
        );
      });

      await startBackgroundLocation(options);
      await refreshStatus();
    } catch (error) {
      removeListener();
      setResult(
        "foregroundListener",
        createScenarioResult("failed", shortError(error))
      );
    }
  };

  const runCleanup = async () => {
    try {
      await cleanup();
      resetResults();
      setLiveUpdates(0);
      updateCountRef.current = 0;
    } catch (error) {
      setResult(
        "foregroundListener",
        createScenarioResult("failed", shortError(error))
      );
    }
  };

  return (
    <ScenarioScreen
      prefix={PREFIX}
      title="Issue 132"
      subtitle="Foreground-service listener must not start Headless JS when no task is registered"
    >
      <ScenarioSection
        index={1}
        title="Observed State"
        description="The E2E script checks logcat for missing Headless JS task warnings"
      >
        <StatusBlock
          testID={`${PREFIX}-status-card`}
          rows={[
            {
              label: "Status:",
              value: status,
              testID: `${PREFIX}-status`
            },
            {
              label: "Live updates:",
              value: liveUpdates,
              testID: `${PREFIX}-live-updates`
            }
          ]}
        />
        <ButtonRow>
          <ScenarioButton
            title="Refresh"
            onPress={refreshStatus}
            testID={`${PREFIX}-refresh-button`}
            containerStyle={sharedStyles.button}
          />
          <ScenarioButton
            title="Cleanup"
            onPress={runCleanup}
            color="#6B7280"
            testID={`${PREFIX}-cleanup-button`}
            containerStyle={sharedStyles.button}
          />
        </ButtonRow>
      </ScenarioSection>

      <ScenarioSection
        index={2}
        title="Foreground Listener Repro"
        description="Runs without registerBackgroundTask in the no-headless bundle"
        divided
      >
        <ScenarioButton
          title="Start Foreground Listener"
          onPress={runForegroundListener}
          testID={`${PREFIX}-start-button`}
        />
        <ResultList
          prefix={PREFIX}
          results={results}
          items={[
            {
              id: "foreground-listener",
              resultKey: "foregroundListener",
              label: "Foreground listener"
            }
          ]}
        />
      </ScenarioSection>
    </ScenarioScreen>
  );
}
