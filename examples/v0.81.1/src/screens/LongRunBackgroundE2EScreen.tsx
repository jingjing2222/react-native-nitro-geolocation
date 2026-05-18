import React from "react";
import {
  ButtonRow,
  ResultList,
  ScenarioButton,
  ScenarioScreen,
  ScenarioSection,
  StatusBlock,
  sharedStyles
} from "./scenario";
import { useLongRunBackgroundScenario } from "./scenario/native-e2e";

const PREFIX = "background-long-run";

export function LongRunBackgroundE2EScreen() {
  const {
    results,
    resetResults,
    snapshot,
    refreshSnapshot,
    runPrepare,
    armRebootProbe,
    validateBackgroundLocation,
    validateHeadless,
    validateGeofenceTransition,
    validateRebootRestore,
    validateIOSDrain,
    validatePlatformLimits,
    runCleanup
  } = useLongRunBackgroundScenario();

  return (
    <ScenarioScreen
      prefix={PREFIX}
      title="Background Long Run E2E"
      subtitle="Device-level background, headless, reboot, geofence, and drain checks"
    >
      <ScenarioSection
        index={1}
        title="Observed Native State"
        description="Counts are read from native storage, not React state"
      >
        <StatusBlock
          testID={`${PREFIX}-status-card`}
          rows={[
            {
              label: "Status:",
              value: snapshot.status,
              testID: `${PREFIX}-status`
            },
            {
              label: "Running:",
              value: snapshot.running,
              testID: `${PREFIX}-running`
            },
            {
              label: "Configured:",
              value: snapshot.configured,
              testID: `${PREFIX}-configured`
            },
            {
              label: "Foreground service:",
              value: snapshot.foregroundService,
              testID: `${PREFIX}-foreground-service`
            },
            {
              label: "Stored locations:",
              value: snapshot.storedLocations,
              testID: `${PREFIX}-stored-locations`
            },
            {
              label: "Stored events:",
              value: snapshot.storedEvents,
              testID: `${PREFIX}-stored-events`
            },
            {
              label: "Post-prepare locations:",
              value: snapshot.postPrepareLocations,
              testID: `${PREFIX}-post-prepare-locations`
            },
            {
              label: "Post-prepare location events:",
              value: snapshot.postPrepareLocationEvents,
              testID: `${PREFIX}-post-prepare-location-events`
            },
            {
              label: "Delivered events:",
              value: snapshot.deliveredEvents,
              testID: `${PREFIX}-delivered-events`
            },
            {
              label: "Location events:",
              value: snapshot.locationEvents,
              testID: `${PREFIX}-location-events`
            },
            {
              label: "Delivered location events:",
              value: snapshot.deliveredLocationEvents,
              testID: `${PREFIX}-delivered-location-events`
            },
            {
              label: "Geofence enter:",
              value: snapshot.geofenceEnterEvents,
              testID: `${PREFIX}-geofence-enter-events`
            },
            {
              label: "Geofence exit:",
              value: snapshot.geofenceExitEvents,
              testID: `${PREFIX}-geofence-exit-events`
            },
            {
              label: "Post-reboot locations:",
              value: snapshot.postRebootLocations,
              testID: `${PREFIX}-post-reboot-locations`
            },
            {
              label: "Post-reboot location events:",
              value: snapshot.postRebootLocationEvents,
              testID: `${PREFIX}-post-reboot-location-events`
            },
            {
              label: "Post-reboot geofence:",
              value: `${snapshot.postRebootGeofenceEnterEvents}/${snapshot.postRebootGeofenceExitEvents}`,
              testID: `${PREFIX}-post-reboot-geofence-events`
            },
            {
              label: "Geofences:",
              value: snapshot.geofences,
              testID: `${PREFIX}-geofence-count`
            },
            {
              label: "Prepared at:",
              value: snapshot.preparedAt,
              testID: `${PREFIX}-prepared-at`
            },
            {
              label: "Reboot proof after:",
              value: snapshot.rebootProofAfter,
              testID: `${PREFIX}-reboot-proof-after`
            },
            {
              label: "Last event:",
              value: snapshot.lastEvent,
              testID: `${PREFIX}-last-event`
            }
          ]}
        />
        <ButtonRow>
          <ScenarioButton
            title="Refresh"
            onPress={refreshSnapshot}
            testID={`${PREFIX}-refresh-button`}
            containerStyle={sharedStyles.button}
          />
          <ScenarioButton
            title="Reset Results"
            onPress={resetResults}
            color="#6B7280"
            testID={`${PREFIX}-reset-results-button`}
            containerStyle={sharedStyles.button}
          />
        </ButtonRow>
      </ScenarioSection>

      <ScenarioSection
        index={2}
        title="Long Run Setup"
        description="Clears native queues, registers geofence, and starts tracking"
        divided
      >
        <ScenarioButton
          title="Prepare Long Run"
          onPress={runPrepare}
          testID={`${PREFIX}-prepare-button`}
        />
        <ScenarioButton
          title="Arm Reboot Probe"
          onPress={armRebootProbe}
          testID={`${PREFIX}-arm-reboot-button`}
        />
        <ResultList
          prefix={PREFIX}
          results={results}
          items={[
            { id: "prepare", label: "Prepare" },
            {
              id: "reboot-probe",
              resultKey: "rebootProbe",
              label: "Reboot probe"
            }
          ]}
        />
      </ScenarioSection>

      <ScenarioSection
        index={3}
        title="Device Long Run Assertions"
        description="Run after app backgrounding, movement injection, or reboot"
        divided
      >
        <ScenarioButton
          title="Validate Background Location"
          onPress={validateBackgroundLocation}
          testID={`${PREFIX}-validate-location-button`}
        />
        <ScenarioButton
          title="Validate Headless Delivery"
          onPress={validateHeadless}
          testID={`${PREFIX}-validate-headless-button`}
        />
        <ScenarioButton
          title="Validate Geofence Transition"
          onPress={validateGeofenceTransition}
          testID={`${PREFIX}-validate-geofence-button`}
        />
        <ScenarioButton
          title="Validate Reboot Restore"
          onPress={validateRebootRestore}
          testID={`${PREFIX}-validate-reboot-button`}
        />
        <ScenarioButton
          title="Validate iOS Drain"
          onPress={validateIOSDrain}
          testID={`${PREFIX}-validate-ios-drain-button`}
        />
        <ScenarioButton
          title="Confirm Platform Limits"
          onPress={validatePlatformLimits}
          testID={`${PREFIX}-platform-limits-button`}
        />
        <ScenarioButton
          title="Cleanup"
          onPress={runCleanup}
          color="#6B7280"
          testID={`${PREFIX}-cleanup-button`}
        />
        <ResultList
          prefix={PREFIX}
          results={results}
          items={[
            {
              id: "background-location",
              resultKey: "backgroundLocation",
              label: "Background location"
            },
            { id: "headless", label: "Headless" },
            {
              id: "geofence-transition",
              resultKey: "geofenceTransition",
              label: "Geofence transition"
            },
            {
              id: "reboot-restore",
              resultKey: "rebootRestore",
              label: "Reboot restore"
            },
            { id: "ios-drain", resultKey: "iosDrain", label: "iOS drain" },
            {
              id: "platform-limits",
              resultKey: "platformLimits",
              label: "Platform limits"
            },
            { id: "cleanup", label: "Cleanup" }
          ]}
        />
      </ScenarioSection>
    </ScenarioScreen>
  );
}
