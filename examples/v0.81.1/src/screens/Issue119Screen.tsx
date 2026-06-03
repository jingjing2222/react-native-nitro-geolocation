import React from "react";
import { Platform } from "react-native";
import { requestPermission } from "react-native-nitro-geolocation";
import {
  ResultList,
  ScenarioButton,
  ScenarioScreen,
  ScenarioSection,
  createScenarioResult,
  createScenarioResults,
  useScenarioResults
} from "./scenario";

const initialResults = createScenarioResults(["permissionPrompt"] as const);

const shortError = (error: unknown) =>
  String((error as { message?: unknown })?.message ?? error)
    .split("\n")[0]
    .slice(0, 160);

export default function Issue119Screen() {
  const { results, setResult } = useScenarioResults(initialResults);

  const run = async () => {
    setResult(
      "permissionPrompt",
      createScenarioResult("running", "Calling requestPermission()")
    );
    if (Platform.OS !== "android") {
      setResult(
        "permissionPrompt",
        createScenarioResult("passed", "Android-only repro skipped on iOS")
      );
      return;
    }

    try {
      const status = await requestPermission();
      setResult(
        "permissionPrompt",
        createScenarioResult(
          status === "granted" ? "passed" : "failed",
          `requestPermission resolved ${status}; expected granted after native prompt`
        )
      );
    } catch (error) {
      setResult(
        "permissionPrompt",
        createScenarioResult("failed", shortError(error))
      );
    }
  };

  return (
    <ScenarioScreen
      prefix="issue-119"
      title="Issue 119"
      subtitle="Android requestPermission should show native prompt"
    >
      <ScenarioSection
        index={1}
        title="Android Permission Prompt"
        description="requestPermission should resolve granted after native allow"
      >
        <ScenarioButton
          title="Run Issue 119"
          onPress={run}
          testID="issue-119-run-button"
        />
      </ScenarioSection>
      <ResultList
        prefix="issue-119"
        results={results}
        items={[
          {
            id: "permission-prompt",
            resultKey: "permissionPrompt",
            label: "Issue 119"
          }
        ]}
      />
    </ScenarioScreen>
  );
}
