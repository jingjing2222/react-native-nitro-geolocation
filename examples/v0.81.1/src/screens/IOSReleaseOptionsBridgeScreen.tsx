import React from "react";
import {
  PermissionStatusBlock,
  ResultBlock,
  ScenarioButton,
  ScenarioScreen,
  ScenarioSection,
  StatusBlock
} from "./scenario";
import { useIOSReleaseOptionsBridgeScenario } from "./scenario/native-e2e";

const PREFIX = "ios-release-options-bridge";

export default function IOSReleaseOptionsBridgeScreen() {
  const {
    permissionStatus,
    results,
    updateCount,
    runDistanceFilterGuard,
    runMaximumAgeZeroGuard,
    runHeadingFilterGuard
  } = useIOSReleaseOptionsBridgeScenario();

  return (
    <ScenarioScreen
      prefix={PREFIX}
      title="iOS Release Options Bridge"
      subtitle="Native Swift optional struct bridge contract"
    >
      <ScenarioSection index={1} title="Permission">
        <PermissionStatusBlock prefix={PREFIX} status={permissionStatus} />
      </ScenarioSection>

      <ScenarioSection
        index={2}
        title="Distance Filter Guard"
        description="Release bridge regression check for caller options on watchPosition."
        divided
      >
        <StatusBlock
          rows={[
            {
              label: "Updates:",
              value: updateCount,
              testID: `${PREFIX}-update-count`
            }
          ]}
        />
        <ScenarioButton
          title="Run Distance Filter Guard"
          onPress={runDistanceFilterGuard}
          testID={`${PREFIX}-run-distance-filter-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="distance-filter"
          label="Distance filter guard"
          result={results.distanceFilter}
        />
      </ScenarioSection>

      <ScenarioSection
        index={3}
        title="Maximum Age Option Guard"
        description="Release bridge regression check that maximumAge=0 filters cached locations in native Swift."
        divided
      >
        <ScenarioButton
          title="Run Maximum Age Option Guard"
          onPress={runMaximumAgeZeroGuard}
          testID={`${PREFIX}-run-maximum-age-zero-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="maximum-age-zero"
          label="Maximum age option guard"
          result={results.maximumAgeZero}
        />
      </ScenarioSection>

      <ScenarioSection
        index={4}
        title="Heading Filter Option Guard"
        description="Release bridge regression check that headingFilter=-1 reaches native Swift validation."
        divided
      >
        <ScenarioButton
          title="Run Heading Filter Option Guard"
          onPress={runHeadingFilterGuard}
          testID={`${PREFIX}-run-heading-filter-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="heading-filter"
          label="Heading filter option guard"
          result={results.headingFilter}
        />
      </ScenarioSection>
    </ScenarioScreen>
  );
}
