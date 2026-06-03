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

const initialResults = createScenarioResults(["stopWithoutMotion"] as const);

const shortError = (error: unknown) =>
  String((error as { message?: unknown })?.message ?? error)
    .split("\n")[0]
    .slice(0, 160);

const options: BackgroundLocationOptions = {
  accuracy: { ios: "bestForNavigation" },
  trackingMode: "continuous",
  startOnBoot: false,
  stopOnTerminate: true,
  ios: {
    pausesLocationUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: false
  }
};

export default function Issue120Screen() {
  const { results, setResult } = useScenarioResults(initialResults);

  const run = async () => {
    setResult(
      "stopWithoutMotion",
      createScenarioResult("running", "Starting and stopping location")
    );
    if (Platform.OS !== "ios") {
      setResult(
        "stopWithoutMotion",
        createScenarioResult("passed", "iOS-only repro skipped on Android")
      );
      return;
    }

    try {
      await stopBackgroundLocation().catch(() => undefined);
      await startBackgroundLocation(options);
      await stopBackgroundLocation();
      setResult(
        "stopWithoutMotion",
        createScenarioResult(
          "passed",
          "Stopped without requesting activity recognition"
        )
      );
    } catch (error) {
      setResult(
        "stopWithoutMotion",
        createScenarioResult("failed", shortError(error))
      );
    }
  };

  return (
    <ScenarioScreen
      prefix="issue-120"
      title="Issue 120"
      subtitle="iOS stopBackgroundLocation must not request extra permission"
    >
      <ScenarioSection
        index={1}
        title="Stop Without Motion"
        description="Continuous tracking has no activityRecognition options"
      >
        <ScenarioButton
          title="Run Issue 120"
          onPress={run}
          testID="issue-120-run-button"
        />
      </ScenarioSection>
      <ResultList
        prefix="issue-120"
        results={results}
        items={[
          {
            id: "stop-without-motion",
            resultKey: "stopWithoutMotion",
            label: "Issue 120"
          }
        ]}
      />
    </ScenarioScreen>
  );
}
