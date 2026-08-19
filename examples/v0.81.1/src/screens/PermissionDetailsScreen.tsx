import React from "react";
import { Platform } from "react-native";
import {
  checkPermission,
  getPermissionDetails
} from "react-native-nitro-geolocation";
import type { PermissionDetails } from "react-native-nitro-geolocation";
import {
  ResultBlock,
  ScenarioButton,
  ScenarioScreen,
  ScenarioSection,
  createScenarioResults,
  getDisplayErrorMessage,
  useScenarioResults
} from "./scenario";

const PREFIX = "permission-details";
const initialResults = createScenarioResults([
  "initial",
  "granted",
  "coarse",
  "denied"
] as const);

function formatDetails(details: PermissionDetails, unchanged: boolean) {
  return [
    `status=${details.status}`,
    `scope=${details.scope}`,
    `accuracy=${details.accuracy}`,
    `canAskAgain=${details.canAskAgain ?? "unknown"}`,
    `settings=${details.settingsGuidance}`,
    `unchanged=${unchanged}`
  ].join("; ");
}

function assertInitial(details: PermissionDetails) {
  if (Platform.OS === "android") {
    if (
      details.status !== "denied" ||
      details.canAskAgain !== null ||
      details.settingsGuidance !== "requestPermissionOrReviewSettings"
    ) {
      throw new Error(
        `Unexpected Android initial details: ${formatDetails(details, true)}`
      );
    }
    return;
  }

  if (
    details.status !== "undetermined" ||
    details.canAskAgain !== true ||
    details.settingsGuidance !== "requestPermission"
  ) {
    throw new Error(
      `Unexpected iOS initial details: ${formatDetails(details, true)}`
    );
  }
}

function assertGranted(details: PermissionDetails) {
  if (
    details.status !== "granted" ||
    details.scope === "none" ||
    details.canAskAgain !== false ||
    details.settingsGuidance !== "none"
  ) {
    throw new Error(
      `Unexpected granted details: ${formatDetails(details, true)}`
    );
  }
}

function assertCoarse(details: PermissionDetails) {
  if (
    details.status !== "granted" ||
    details.scope !== "foreground" ||
    details.accuracy !== "reduced"
  ) {
    throw new Error(
      `Unexpected coarse details: ${formatDetails(details, true)}`
    );
  }
}

function assertDenied(details: PermissionDetails) {
  const expectedCanAskAgain = Platform.OS === "android" ? null : false;
  const expectedGuidance =
    Platform.OS === "android"
      ? "requestPermissionOrReviewSettings"
      : "reviewSettings";
  if (
    details.status !== "denied" ||
    details.scope !== "none" ||
    details.canAskAgain !== expectedCanAskAgain ||
    details.settingsGuidance !== expectedGuidance
  ) {
    throw new Error(
      `Unexpected denied details: ${formatDetails(details, true)}`
    );
  }
}

export default function PermissionDetailsScreen() {
  const { results, setResult } = useScenarioResults(initialResults);

  const runScenario = async (
    id: keyof typeof initialResults,
    assertion: (details: PermissionDetails) => void
  ) => {
    setResult(id, {
      status: "running",
      message:
        "Reading permission details without requesting or opening settings"
    });

    try {
      const before = await checkPermission();
      const details = await getPermissionDetails();
      const after = await checkPermission();
      const unchanged = before === after && details.status === after;
      if (!unchanged) {
        throw new Error(
          `Read changed permission: before=${before}; after=${after}`
        );
      }
      assertion(details);
      setResult(id, {
        status: "passed",
        message: formatDetails(details, unchanged)
      });
    } catch (error) {
      setResult(id, {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    }
  };

  return (
    <ScenarioScreen
      prefix={PREFIX}
      title="Permission Details"
      subtitle="Read-only scope, accuracy, prompt capability, and settings guidance"
    >
      <ScenarioSection index={1} title="Initial State">
        <ScenarioButton
          title="Read Initial Details"
          onPress={() => runScenario("initial", assertInitial)}
          testID={`${PREFIX}-run-initial-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="initial"
          label="Initial details"
          result={results.initial}
        />
      </ScenarioSection>

      <ScenarioSection index={2} title="Granted Scope" divided>
        <ScenarioButton
          title="Read Granted Details"
          onPress={() => runScenario("granted", assertGranted)}
          testID={`${PREFIX}-run-granted-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="granted"
          label="Granted details"
          result={results.granted}
        />
      </ScenarioSection>

      {Platform.OS === "android" ? (
        <ScenarioSection index={3} title="Approximate Scope" divided>
          <ScenarioButton
            title="Read Coarse Details"
            onPress={() => runScenario("coarse", assertCoarse)}
            testID={`${PREFIX}-run-coarse-button`}
          />
          <ResultBlock
            prefix={PREFIX}
            id="coarse"
            label="Coarse details"
            result={results.coarse}
          />
        </ScenarioSection>
      ) : null}

      <ScenarioSection
        index={Platform.OS === "android" ? 4 : 3}
        title="Denied State"
        divided
      >
        <ScenarioButton
          title="Read Denied Details"
          onPress={() => runScenario("denied", assertDenied)}
          color="#7B1FA2"
          testID={`${PREFIX}-run-denied-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="denied"
          label="Denied details"
          result={results.denied}
        />
      </ScenarioSection>
    </ScenarioScreen>
  );
}
