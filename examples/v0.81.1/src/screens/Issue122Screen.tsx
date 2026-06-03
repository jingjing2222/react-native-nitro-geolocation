import React, { useRef } from "react";
import { Platform } from "react-native";
import {
  clearStoredBackgroundEvents,
  clearStoredBackgroundLocations,
  getBackgroundLocationStatus,
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

const initialResults = createScenarioResults(["persistFalse"] as const);

const shortError = (error: unknown) =>
  String((error as { message?: unknown })?.message ?? error)
    .split("\n")[0]
    .slice(0, 160);

const options: BackgroundLocationOptions = {
  accuracy: { ios: "bestForNavigation" },
  persist: false,
  trackingMode: "continuous",
  startOnBoot: false,
  stopOnTerminate: true,
  ios: {
    activityType: "automotiveNavigation",
    pausesLocationUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: false
  }
};

export default function Issue122Screen() {
  const { results, setResult } = useScenarioResults(initialResults);
  const startedAtRef = useRef<number | undefined>(undefined);

  const start = async () => {
    setResult(
      "persistFalse",
      createScenarioResult("running", "Starting persist=false tracking")
    );
    if (Platform.OS !== "ios") {
      setResult(
        "persistFalse",
        createScenarioResult("passed", "iOS-only repro skipped on Android")
      );
      return;
    }

    try {
      await stopBackgroundLocation().catch(() => undefined);
      await clearStoredBackgroundEvents().catch(() => undefined);
      await clearStoredBackgroundLocations().catch(() => undefined);
      startedAtRef.current = Date.now();
      await startBackgroundLocation(options);
      setResult(
        "persistFalse",
        createScenarioResult("running", "persist=false tracking started")
      );
    } catch (error) {
      setResult(
        "persistFalse",
        createScenarioResult("failed", shortError(error))
      );
    }
  };

  const validate = async () => {
    setResult(
      "persistFalse",
      createScenarioResult("running", "Validating UI responsiveness")
    );
    if (Platform.OS !== "ios") {
      setResult(
        "persistFalse",
        createScenarioResult("passed", "iOS-only repro skipped on Android")
      );
      return;
    }

    try {
      await stopBackgroundLocation();
      const status = await getBackgroundLocationStatus();
      const elapsed = Date.now() - (startedAtRef.current ?? Date.now());
      const storedCount = status.storedEventCount + status.storedLocationCount;

      setResult(
        "persistFalse",
        createScenarioResult(
          storedCount === 0 && elapsed < 5000 ? "passed" : "failed",
          `persist=false stored=${storedCount}, elapsed=${elapsed}ms`
        )
      );
    } catch (error) {
      setResult(
        "persistFalse",
        createScenarioResult("failed", shortError(error))
      );
    }
  };

  return (
    <ScenarioScreen
      prefix="issue-122"
      title="Issue 122"
      subtitle="iOS persist=false should not degrade UI responsiveness"
    >
      <ScenarioSection
        index={1}
        title="Persist False"
        description="No background events or locations should persist"
      >
        <ScenarioButton
          title="Start Issue 122"
          onPress={start}
          testID="issue-122-run-button"
        />
        <ScenarioButton
          title="Validate Issue 122"
          onPress={validate}
          testID="issue-122-validate-button"
        />
      </ScenarioSection>
      <ResultList
        prefix="issue-122"
        results={results}
        items={[
          {
            id: "persist-false",
            resultKey: "persistFalse",
            label: "Issue 122"
          }
        ]}
      />
    </ScenarioScreen>
  );
}
