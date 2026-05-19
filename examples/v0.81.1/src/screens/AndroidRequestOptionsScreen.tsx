import React from "react";
import {
  PermissionStatusBlock,
  ResultList,
  ScenarioButton,
  ScenarioScreen,
  ScenarioSection
} from "./scenario";
import type { AndroidRequestOptionsResultKey } from "./scenario/native-e2e";
import { useAndroidRequestOptionsScenario } from "./scenario/native-e2e";

const PREFIX = "android-request-options";

export default function AndroidRequestOptionsScreen() {
  const {
    permissionStatus,
    results,
    runAutoProviderScenario,
    runPlayServicesProviderScenario,
    runPlatformProviderScenario,
    runFusedRequestScenario,
    runOneShotDistanceFilterScenario,
    runCoarseCacheScenario,
    runMixedWatchScenario,
    runMaxUpdatesScenario,
    runHeadingUnwatchScenario,
    runInvalidMaxUpdatesScenario,
    runFineDeniedScenario
  } = useAndroidRequestOptionsScenario();

  const renderResultSection = ({
    index,
    title,
    buttonTitle,
    onPress,
    color,
    buttonTestID,
    resultId,
    resultKey,
    resultLabel
  }: {
    index: number;
    title: string;
    buttonTitle: string;
    onPress: () => Promise<void>;
    color: string;
    buttonTestID: string;
    resultId: string;
    resultKey: AndroidRequestOptionsResultKey;
    resultLabel: string;
  }) => (
    <ScenarioSection index={index} title={title} divided>
      <ScenarioButton
        title={buttonTitle}
        onPress={onPress}
        color={color}
        testID={buttonTestID}
      />
      <ResultList
        prefix={PREFIX}
        results={results}
        items={[
          {
            id: resultId,
            label: resultLabel,
            resultKey
          }
        ]}
      />
    </ScenarioSection>
  );

  return (
    <ScenarioScreen
      prefix={PREFIX}
      title="Android Request Options"
      subtitle="Provider selection, fused request controls, and rejection paths"
    >
      <ScenarioSection index={1} title="Permission">
        <PermissionStatusBlock prefix={PREFIX} status={permissionStatus} />
      </ScenarioSection>

      {renderResultSection({
        index: 2,
        title: "Auto Provider Selection",
        buttonTitle: "Run Auto Provider",
        onPress: runAutoProviderScenario,
        color: "#1976D2",
        buttonTestID: `${PREFIX}-run-auto-provider-button`,
        resultId: "auto-provider",
        resultKey: "autoProvider",
        resultLabel: "Auto provider"
      })}

      {renderResultSection({
        index: 3,
        title: "Play Services Provider Selection",
        buttonTitle: "Run Play Services Provider",
        onPress: runPlayServicesProviderScenario,
        color: "#0288D1",
        buttonTestID: `${PREFIX}-run-play-services-provider-button`,
        resultId: "play-services-provider",
        resultKey: "playServicesProvider",
        resultLabel: "Play Services provider"
      })}

      {renderResultSection({
        index: 4,
        title: "Platform Provider Selection",
        buttonTitle: "Run Platform Provider",
        onPress: runPlatformProviderScenario,
        color: "#455A64",
        buttonTestID: `${PREFIX}-run-platform-provider-button`,
        resultId: "platform-provider",
        resultKey: "platformProvider",
        resultLabel: "Platform provider"
      })}

      {renderResultSection({
        index: 5,
        title: "Fused Coarse Request",
        buttonTitle: "Run Fused Request",
        onPress: runFusedRequestScenario,
        color: "#0288D1",
        buttonTestID: `${PREFIX}-run-fused-button`,
        resultId: "fused",
        resultKey: "fused",
        resultLabel: "Fused request"
      })}

      {renderResultSection({
        index: 6,
        title: "One-Shot Distance Filter",
        buttonTitle: "Run One-Shot Distance Filter",
        onPress: runOneShotDistanceFilterScenario,
        color: "#00695C",
        buttonTestID: `${PREFIX}-run-one-shot-distance-button`,
        resultId: "one-shot-distance",
        resultKey: "oneShotDistance",
        resultLabel: "One-shot distance"
      })}

      {renderResultSection({
        index: 7,
        title: "Coarse Cache Isolation",
        buttonTitle: "Run Coarse Cache Isolation",
        onPress: runCoarseCacheScenario,
        color: "#5E35B1",
        buttonTestID: `${PREFIX}-run-coarse-cache-button`,
        resultId: "coarse-cache",
        resultKey: "coarseCache",
        resultLabel: "Coarse cache"
      })}

      {renderResultSection({
        index: 8,
        title: "Mixed Watch Granularity",
        buttonTitle: "Run Mixed Watch Granularity",
        onPress: runMixedWatchScenario,
        color: "#546E7A",
        buttonTestID: `${PREFIX}-run-mixed-watch-button`,
        resultId: "mixed-watch",
        resultKey: "mixedWatch",
        resultLabel: "Mixed watch"
      })}

      {renderResultSection({
        index: 9,
        title: "Max Updates Watch",
        buttonTitle: "Run Max Updates Watch",
        onPress: runMaxUpdatesScenario,
        color: "#00897B",
        buttonTestID: `${PREFIX}-run-max-updates-button`,
        resultId: "max-updates",
        resultKey: "maxUpdates",
        resultLabel: "Max updates"
      })}

      {renderResultSection({
        index: 10,
        title: "Heading Unwatch Isolation",
        buttonTitle: "Run Heading Unwatch Isolation",
        onPress: runHeadingUnwatchScenario,
        color: "#6D4C41",
        buttonTestID: `${PREFIX}-run-heading-unwatch-button`,
        resultId: "heading-unwatch",
        resultKey: "headingUnwatch",
        resultLabel: "Heading unwatch"
      })}

      {renderResultSection({
        index: 11,
        title: "Invalid Max Updates",
        buttonTitle: "Run Invalid Max Updates",
        onPress: runInvalidMaxUpdatesScenario,
        color: "#D84315",
        buttonTestID: `${PREFIX}-run-invalid-button`,
        resultId: "invalid",
        resultKey: "invalid",
        resultLabel: "Invalid maxUpdates"
      })}

      {renderResultSection({
        index: 12,
        title: "Fine Permission Gate",
        buttonTitle: "Run Fine Permission Gate",
        onPress: runFineDeniedScenario,
        color: "#7B1FA2",
        buttonTestID: `${PREFIX}-run-fine-denied-button`,
        resultId: "fine-denied",
        resultKey: "fineDenied",
        resultLabel: "Fine permission"
      })}
    </ScenarioScreen>
  );
}
