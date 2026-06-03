import React from "react";
import { Platform } from "react-native";
import {
  startBackgroundLocation,
  stopBackgroundLocation
} from "react-native-nitro-geolocation/background";
import type { BackgroundLocationOptions } from "react-native-nitro-geolocation/background";
import {
  ResultList,
  ScenarioButton,
  ScenarioScreen,
  ScenarioSection,
  createScenarioResult,
  createScenarioResults,
  useScenarioResults
} from "./scenario";

const initialResults = createScenarioResults(["foregroundService"] as const);

const shortError = (error: unknown) =>
  String((error as { message?: unknown })?.message ?? error)
    .split("\n")[0]
    .slice(0, 160);

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const options: BackgroundLocationOptions = {
  accuracy: { android: "high" },
  trackingMode: "continuous",
  android: {
    foregroundService: {
      notificationTitle: "Issue 121",
      notificationText: "Foreground service location repro",
      notificationChannelId: "nitro-issue-121",
      notificationChannelName: "Nitro Issue 121"
    }
  },
  startOnBoot: false,
  stopOnTerminate: true
};

export default function Issue121Screen() {
  const { results, setResult } = useScenarioResults(initialResults);

  const run = async () => {
    setResult(
      "foregroundService",
      createScenarioResult(
        "running",
        "Starting foreground service without background grant"
      )
    );
    if (Platform.OS !== "android") {
      setResult(
        "foregroundService",
        createScenarioResult("passed", "Android-only repro skipped on iOS")
      );
      return;
    }

    try {
      await stopBackgroundLocation().catch(() => undefined);
      await startBackgroundLocation(options);
      await sleep(1500);
      await stopBackgroundLocation();
      setResult(
        "foregroundService",
        createScenarioResult(
          "passed",
          "Foreground service started without background grant"
        )
      );
    } catch (error) {
      setResult(
        "foregroundService",
        createScenarioResult("failed", shortError(error))
      );
    }
  };

  return (
    <ScenarioScreen
      prefix="issue-121"
      title="Issue 121"
      subtitle="Android foreground service should not require background grant"
    >
      <ScenarioSection
        index={1}
        title="Foreground Service"
        description="Foreground service path should start with foreground permission"
      >
        <ScenarioButton
          title="Run Issue 121"
          onPress={run}
          testID="issue-121-run-button"
        />
      </ScenarioSection>
      <ResultList
        prefix="issue-121"
        results={results}
        items={[
          {
            id: "foreground-service",
            resultKey: "foregroundService",
            label: "Issue 121"
          }
        ]}
      />
    </ScenarioScreen>
  );
}
