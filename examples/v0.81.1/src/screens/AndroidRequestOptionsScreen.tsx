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

type AndroidRequestOptionsGroup =
  | "providers"
  | "requests"
  | "watches"
  | "errors";

type AndroidRequestOptionsScenarioItem = {
  color: string;
  resultId: string;
  resultKey: AndroidRequestOptionsResultKey;
  resultLabel: string;
  runKey:
    | "runAutoProviderScenario"
    | "runPlayServicesProviderScenario"
    | "runPlatformProviderScenario"
    | "runFusedRequestScenario"
    | "runOneShotDistanceFilterScenario"
    | "runCoarseCacheScenario"
    | "runMixedWatchScenario"
    | "runMaxUpdatesScenario"
    | "runHeadingUnwatchScenario"
    | "runInvalidMaxUpdatesScenario"
    | "runFineDeniedScenario";
  title: string;
  buttonTitle: string;
  buttonTestID: string;
};

const GROUP_CONFIG: Record<
  AndroidRequestOptionsGroup,
  {
    title: string;
    subtitle: string;
    items: AndroidRequestOptionsScenarioItem[];
  }
> = {
  providers: {
    title: "Android Provider Options",
    subtitle: "Live provider selection contracts for physical Android devices",
    items: [
      {
        title: "Auto Provider Selection",
        buttonTitle: "Run Auto Provider",
        runKey: "runAutoProviderScenario",
        color: "#1976D2",
        buttonTestID: `${PREFIX}-run-auto-provider-button`,
        resultId: "auto-provider",
        resultKey: "autoProvider",
        resultLabel: "Auto provider"
      },
      {
        title: "Play Services Provider Selection",
        buttonTitle: "Run Play Services Provider",
        runKey: "runPlayServicesProviderScenario",
        color: "#0288D1",
        buttonTestID: `${PREFIX}-run-play-services-provider-button`,
        resultId: "play-services-provider",
        resultKey: "playServicesProvider",
        resultLabel: "Play Services provider"
      },
      {
        title: "Platform Provider Selection",
        buttonTitle: "Run Platform Provider",
        runKey: "runPlatformProviderScenario",
        color: "#455A64",
        buttonTestID: `${PREFIX}-run-platform-provider-button`,
        resultId: "platform-provider",
        resultKey: "platformProvider",
        resultLabel: "Platform provider"
      }
    ]
  },
  requests: {
    title: "Android Request Options",
    subtitle: "Fused one-shot request and cache isolation contracts",
    items: [
      {
        title: "Fused Coarse Request",
        buttonTitle: "Run Fused Request",
        runKey: "runFusedRequestScenario",
        color: "#0288D1",
        buttonTestID: `${PREFIX}-run-fused-button`,
        resultId: "fused",
        resultKey: "fused",
        resultLabel: "Fused request"
      },
      {
        title: "One-Shot Distance Filter",
        buttonTitle: "Run One-Shot Distance Filter",
        runKey: "runOneShotDistanceFilterScenario",
        color: "#00695C",
        buttonTestID: `${PREFIX}-run-one-shot-distance-button`,
        resultId: "one-shot-distance",
        resultKey: "oneShotDistance",
        resultLabel: "One-shot distance"
      },
      {
        title: "Coarse Cache Isolation",
        buttonTitle: "Run Coarse Cache Isolation",
        runKey: "runCoarseCacheScenario",
        color: "#5E35B1",
        buttonTestID: `${PREFIX}-run-coarse-cache-button`,
        resultId: "coarse-cache",
        resultKey: "coarseCache",
        resultLabel: "Coarse cache"
      }
    ]
  },
  watches: {
    title: "Android Watch Options",
    subtitle: "Granularity, maxUpdates, and unwatch isolation contracts",
    items: [
      {
        title: "Mixed Watch Granularity",
        buttonTitle: "Run Mixed Watch Granularity",
        runKey: "runMixedWatchScenario",
        color: "#546E7A",
        buttonTestID: `${PREFIX}-run-mixed-watch-button`,
        resultId: "mixed-watch",
        resultKey: "mixedWatch",
        resultLabel: "Mixed watch"
      },
      {
        title: "Max Updates Watch",
        buttonTitle: "Run Max Updates Watch",
        runKey: "runMaxUpdatesScenario",
        color: "#00897B",
        buttonTestID: `${PREFIX}-run-max-updates-button`,
        resultId: "max-updates",
        resultKey: "maxUpdates",
        resultLabel: "Max updates"
      },
      {
        title: "Heading Unwatch Isolation",
        buttonTitle: "Run Heading Unwatch Isolation",
        runKey: "runHeadingUnwatchScenario",
        color: "#6D4C41",
        buttonTestID: `${PREFIX}-run-heading-unwatch-button`,
        resultId: "heading-unwatch",
        resultKey: "headingUnwatch",
        resultLabel: "Heading unwatch"
      }
    ]
  },
  errors: {
    title: "Android Request Errors",
    subtitle: "Invalid option and permission rejection contracts",
    items: [
      {
        title: "Invalid Max Updates",
        buttonTitle: "Run Invalid Max Updates",
        runKey: "runInvalidMaxUpdatesScenario",
        color: "#D84315",
        buttonTestID: `${PREFIX}-run-invalid-button`,
        resultId: "invalid",
        resultKey: "invalid",
        resultLabel: "Invalid maxUpdates"
      },
      {
        title: "Fine Permission Gate",
        buttonTitle: "Run Fine Permission Gate",
        runKey: "runFineDeniedScenario",
        color: "#7B1FA2",
        buttonTestID: `${PREFIX}-run-fine-denied-button`,
        resultId: "fine-denied",
        resultKey: "fineDenied",
        resultLabel: "Fine permission"
      }
    ]
  }
};

function AndroidRequestOptionsScreen({
  group
}: {
  group: AndroidRequestOptionsGroup;
}) {
  const config = GROUP_CONFIG[group];
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
  const runners = {
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
  };

  const renderResultSection = ({
    index,
    title,
    buttonTitle,
    runKey,
    color,
    buttonTestID,
    resultId,
    resultKey,
    resultLabel
  }: AndroidRequestOptionsScenarioItem & {
    index: number;
  }) => (
    <ScenarioSection key={resultId} index={index} title={title} divided>
      <ScenarioButton
        title={buttonTitle}
        onPress={runners[runKey]}
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
      title={config.title}
      subtitle={config.subtitle}
    >
      <ScenarioSection index={1} title="Permission">
        <PermissionStatusBlock prefix={PREFIX} status={permissionStatus} />
      </ScenarioSection>

      {config.items.map((item, index) =>
        renderResultSection({
          ...item,
          index: index + 2
        })
      )}
    </ScenarioScreen>
  );
}

export function AndroidRequestOptionsProviderScreen() {
  return <AndroidRequestOptionsScreen group="providers" />;
}

export function AndroidRequestOptionsWatchScreen() {
  return <AndroidRequestOptionsScreen group="watches" />;
}

export function AndroidRequestOptionsErrorScreen() {
  return <AndroidRequestOptionsScreen group="errors" />;
}

export default function AndroidRequestOptionsRequestScreen() {
  return <AndroidRequestOptionsScreen group="requests" />;
}
