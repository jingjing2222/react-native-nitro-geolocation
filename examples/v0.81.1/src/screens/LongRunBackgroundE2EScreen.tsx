import React, { useState } from "react";
import { Platform } from "react-native";
import {
  type BackgroundEvent,
  type BackgroundLocationOptions,
  type GeofenceRegion,
  type StoredBackgroundEvent,
  addGeofences,
  clearStoredBackgroundEvents,
  clearStoredBackgroundLocations,
  configureBackgroundLocation,
  getBackgroundLocationStatus,
  getRegisteredGeofences,
  getStoredBackgroundEvents,
  getStoredBackgroundLocations,
  removeGeofences,
  requestBackgroundPermission,
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

const PREFIX = "background-long-run";
const GEOFENCE_ID = "long-run-office";
const GEOFENCE_CENTER = {
  latitude: 37.5665,
  longitude: 126.978
};
const REBOOT_PROOF_DELAY_MS = 15_000;

const initialResults = createScenarioResults([
  "prepare",
  "rebootProbe",
  "backgroundLocation",
  "headless",
  "geofenceTransition",
  "rebootRestore",
  "iosDrain",
  "platformLimits",
  "cleanup"
] as const);

const longRunOptions: BackgroundLocationOptions = {
  trackingMode: Platform.OS === "ios" ? "significantChanges" : "continuous",
  interval: 5_000,
  fastestInterval: 2_000,
  distanceFilter: 0,
  persist: true,
  maxStoredLocations: 20_000,
  maxStoredEvents: 20_000,
  stopOnTerminate: false,
  startOnBoot: true,
  android: {
    locationProvider: "auto",
    requestNotificationPermission: true,
    foregroundService: {
      notificationTitle: "Background long-run E2E",
      notificationText: "Recording native background events",
      notificationChannelId: "nitro-background-long-run-e2e",
      notificationChannelName: "Nitro Background Long Run E2E"
    }
  },
  ios: {
    activityType: "otherNavigation",
    pausesLocationUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    useSignificantChanges: true
  },
  activityRecognition: {
    enabled: Platform.OS === "android",
    interval: 10_000,
    stopOnStill: false,
    minimumConfidence: 50
  }
};

type LongRunSnapshot = {
  status: string;
  running: string;
  configured: string;
  foregroundService: string;
  storedLocations: number;
  storedEvents: number;
  postPrepareLocations: number;
  postPrepareLocationEvents: number;
  deliveredEvents: number;
  locationEvents: number;
  deliveredLocationEvents: number;
  geofenceEnterEvents: number;
  geofenceExitEvents: number;
  postRebootLocations: number;
  postRebootLocationEvents: number;
  postRebootGeofenceEnterEvents: number;
  postRebootGeofenceExitEvents: number;
  geofences: number;
  preparedAt: string;
  rebootProofAfter: string;
  lastEvent: string;
};

const emptySnapshot: LongRunSnapshot = {
  status: "not checked",
  running: "unknown",
  configured: "unknown",
  foregroundService: "unknown",
  storedLocations: 0,
  storedEvents: 0,
  postPrepareLocations: 0,
  postPrepareLocationEvents: 0,
  deliveredEvents: 0,
  locationEvents: 0,
  deliveredLocationEvents: 0,
  geofenceEnterEvents: 0,
  geofenceExitEvents: 0,
  postRebootLocations: 0,
  postRebootLocationEvents: 0,
  postRebootGeofenceEnterEvents: 0,
  postRebootGeofenceExitEvents: 0,
  geofences: 0,
  preparedAt: "none",
  rebootProofAfter: "none",
  lastEvent: "none"
};

const shortError = (error: unknown) =>
  String(error instanceof Error ? error.message : error)
    .split("\n")[0]
    .slice(0, 160);

const eventType = (event: StoredBackgroundEvent) => event.event.type;

const isDeliveredLocationEvent = (event: StoredBackgroundEvent) =>
  event.deliveredToJS && eventType(event) === "location";

const isGeofenceTransition = (
  event: StoredBackgroundEvent,
  transition: "enter" | "exit"
) => {
  const backgroundEvent: BackgroundEvent = event.event;
  return (
    backgroundEvent.type === "geofence" &&
    backgroundEvent.geofence.transition === transition
  );
};

const summarizeEvent = (event?: StoredBackgroundEvent) => {
  if (!event) return "none";
  if (event.event.type === "geofence") {
    return `geofence:${event.event.geofence.transition}:${event.event.geofence.region.identifier}`;
  }
  return `${event.event.type}:${event.deliveredToJS ? "delivered" : "queued"}`;
};

const metadataNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const longRunMarker = (geofences: GeofenceRegion[]) => {
  const metadata = geofences.find(
    (region) => region.identifier === GEOFENCE_ID
  )?.metadata;

  return {
    preparedAt: metadataNumber(metadata?.preparedAt),
    rebootProofAfter: metadataNumber(metadata?.rebootProofAfter)
  };
};

const longRunGeofence = (
  metadata: Record<string, string | number | boolean>
): GeofenceRegion => ({
  identifier: GEOFENCE_ID,
  latitude: GEOFENCE_CENTER.latitude,
  longitude: GEOFENCE_CENTER.longitude,
  radius: 150,
  notifyOnEntry: true,
  notifyOnExit: true,
  metadata: {
    suite: "background-long-run",
    ...metadata
  }
});

export function LongRunBackgroundE2EScreen() {
  const { results, setResult, resetResults } =
    useScenarioResults(initialResults);
  const [snapshot, setSnapshot] = useState<LongRunSnapshot>(emptySnapshot);

  const refreshSnapshot = async () => {
    const [status, geofences] = await Promise.all([
      getBackgroundLocationStatus(),
      getRegisteredGeofences()
    ]);
    const marker = longRunMarker(geofences);
    const preparedSince = marker.preparedAt ?? 0;
    const rebootSince = marker.rebootProofAfter ?? Number.MAX_SAFE_INTEGER;
    const [locations, events, rebootLocations, rebootEvents] =
      await Promise.all([
        getStoredBackgroundLocations({
          includeDelivered: true,
          includeSynced: true,
          since: preparedSince,
          limit: 5_000
        }),
        getStoredBackgroundEvents({
          includeDelivered: true,
          since: preparedSince,
          limit: 5_000
        }),
        getStoredBackgroundLocations({
          includeDelivered: true,
          includeSynced: true,
          since: rebootSince,
          limit: 5_000
        }),
        getStoredBackgroundEvents({
          includeDelivered: true,
          since: rebootSince,
          limit: 5_000
        })
      ]);
    const postPrepareLocationEvents = events.filter(
      (event) => eventType(event) === "location"
    );
    const postRebootLocationEvents = rebootEvents.filter(
      (event) => eventType(event) === "location"
    );
    const postRebootGeofenceEnterEvents = rebootEvents.filter((event) =>
      isGeofenceTransition(event, "enter")
    );
    const postRebootGeofenceExitEvents = rebootEvents.filter((event) =>
      isGeofenceTransition(event, "exit")
    );

    const next: LongRunSnapshot = {
      status: `${status.state} / fg=${status.foregroundPermission} / bg=${status.backgroundPermission}`,
      running: String(status.isRunning),
      configured: String(status.isConfigured),
      foregroundService: String(
        status.android?.isForegroundServiceRunning ?? "n/a"
      ),
      storedLocations: status.storedLocationCount,
      storedEvents: status.storedEventCount,
      postPrepareLocations: locations.length,
      postPrepareLocationEvents: postPrepareLocationEvents.length,
      deliveredEvents: events.filter((event) => event.deliveredToJS).length,
      locationEvents: postPrepareLocationEvents.length,
      deliveredLocationEvents: events.filter(isDeliveredLocationEvent).length,
      geofenceEnterEvents: events.filter((event) =>
        isGeofenceTransition(event, "enter")
      ).length,
      geofenceExitEvents: events.filter((event) =>
        isGeofenceTransition(event, "exit")
      ).length,
      postRebootLocations: rebootLocations.length,
      postRebootLocationEvents: postRebootLocationEvents.length,
      postRebootGeofenceEnterEvents: postRebootGeofenceEnterEvents.length,
      postRebootGeofenceExitEvents: postRebootGeofenceExitEvents.length,
      geofences: geofences.length,
      preparedAt: marker.preparedAt
        ? String(Math.trunc(marker.preparedAt))
        : "none",
      rebootProofAfter: marker.rebootProofAfter
        ? String(Math.trunc(marker.rebootProofAfter))
        : "none",
      lastEvent: summarizeEvent(events[events.length - 1])
    };

    setSnapshot(next);
    return next;
  };

  const runPrepare = async () => {
    setResult(
      "prepare",
      createScenarioResult("running", "Resetting store and starting tracking")
    );
    try {
      await stopBackgroundLocation().catch(() => undefined);
      await resetBackgroundLocation().catch(() => undefined);
      await removeGeofences().catch(() => undefined);
      await clearStoredBackgroundEvents().catch(() => undefined);
      await clearStoredBackgroundLocations().catch(() => undefined);

      const permission = await requestBackgroundPermission();
      if (
        permission.foreground !== "granted" ||
        permission.background !== "granted"
      ) {
        throw new Error(
          `Permission not granted: fg=${permission.foreground}, bg=${permission.background}`
        );
      }

      await configureBackgroundLocation(longRunOptions);
      await addGeofences(
        [
          longRunGeofence({
            preparedAt: Date.now(),
            runId: String(Date.now())
          })
        ],
        {
          initialTrigger: ["enter", "exit"],
          notificationResponsiveness: 1_000
        }
      );
      await startBackgroundLocation(longRunOptions);

      const next = await refreshSnapshot();
      setResult(
        "prepare",
        createScenarioResult(
          next.configured === "true" ? "passed" : "failed",
          `running=${next.running}, geofences=${next.geofences}`
        )
      );
    } catch (error) {
      setResult("prepare", createScenarioResult("failed", shortError(error)));
    }
  };

  const armRebootProbe = async () => {
    setResult(
      "rebootProbe",
      createScenarioResult("running", "Clearing queues and arming reboot proof")
    );
    try {
      if (Platform.OS !== "android") {
        setResult(
          "rebootProbe",
          createScenarioResult("passed", "iOS has no boot receiver contract")
        );
        return;
      }

      const geofences = await getRegisteredGeofences();
      const marker = longRunMarker(geofences);
      await clearStoredBackgroundEvents();
      await clearStoredBackgroundLocations();
      await addGeofences(
        [
          longRunGeofence({
            preparedAt: marker.preparedAt ?? Date.now(),
            rebootProofAfter: Date.now() + REBOOT_PROOF_DELAY_MS,
            runId: String(Date.now())
          })
        ],
        {
          initialTrigger: ["enter", "exit"],
          notificationResponsiveness: 1_000
        }
      );

      const next = await refreshSnapshot();
      setResult(
        "rebootProbe",
        createScenarioResult(
          next.rebootProofAfter !== "none" ? "passed" : "failed",
          `proofAfter=${next.rebootProofAfter}, events=${next.storedEvents}`
        )
      );
    } catch (error) {
      setResult(
        "rebootProbe",
        createScenarioResult("failed", shortError(error))
      );
    }
  };

  const validateBackgroundLocation = async () => {
    setResult(
      "backgroundLocation",
      createScenarioResult("running", "Reading stored background locations")
    );
    try {
      const next = await refreshSnapshot();
      const passed =
        next.postPrepareLocations > 0 && next.postPrepareLocationEvents > 0;
      setResult(
        "backgroundLocation",
        createScenarioResult(
          passed ? "passed" : "failed",
          `postPrepareLocations=${next.postPrepareLocations}, postPrepareEvents=${next.postPrepareLocationEvents}`
        )
      );
    } catch (error) {
      setResult(
        "backgroundLocation",
        createScenarioResult("failed", shortError(error))
      );
    }
  };

  const validateHeadless = async () => {
    setResult(
      "headless",
      createScenarioResult("running", "Checking delivered native events")
    );
    try {
      const next = await refreshSnapshot();
      if (Platform.OS !== "android") {
        setResult(
          "headless",
          createScenarioResult(
            "passed",
            "iOS has no Headless JS; storage drain is expected"
          )
        );
        return;
      }
      const passed = next.deliveredLocationEvents > 0;
      setResult(
        "headless",
        createScenarioResult(
          passed ? "passed" : "failed",
          `deliveredLocationEvents=${next.deliveredLocationEvents}`
        )
      );
    } catch (error) {
      setResult("headless", createScenarioResult("failed", shortError(error)));
    }
  };

  const validateGeofenceTransition = async () => {
    setResult(
      "geofenceTransition",
      createScenarioResult("running", "Checking enter and exit events")
    );
    try {
      const next = await refreshSnapshot();
      const passed =
        next.geofenceEnterEvents > 0 && next.geofenceExitEvents > 0;
      setResult(
        "geofenceTransition",
        createScenarioResult(
          passed ? "passed" : "failed",
          `enter=${next.geofenceEnterEvents}, exit=${next.geofenceExitEvents}`
        )
      );
    } catch (error) {
      setResult(
        "geofenceTransition",
        createScenarioResult("failed", shortError(error))
      );
    }
  };

  const validateRebootRestore = async () => {
    setResult(
      "rebootRestore",
      createScenarioResult("running", "Checking persisted Android restore")
    );
    try {
      const next = await refreshSnapshot();
      if (Platform.OS !== "android") {
        setResult(
          "rebootRestore",
          createScenarioResult("passed", "iOS has no boot receiver contract")
        );
        return;
      }
      const passed =
        next.configured === "true" &&
        next.running === "true" &&
        next.geofences > 0 &&
        next.postRebootLocations > 0 &&
        next.postRebootLocationEvents > 0 &&
        next.postRebootGeofenceEnterEvents > 0 &&
        next.postRebootGeofenceExitEvents > 0;
      setResult(
        "rebootRestore",
        createScenarioResult(
          passed ? "passed" : "failed",
          `running=${next.running}, locations=${next.postRebootLocations}, geofence=${next.postRebootGeofenceEnterEvents}/${next.postRebootGeofenceExitEvents}`
        )
      );
    } catch (error) {
      setResult(
        "rebootRestore",
        createScenarioResult("failed", shortError(error))
      );
    }
  };

  const validateIOSDrain = async () => {
    setResult(
      "iosDrain",
      createScenarioResult("running", "Checking iOS native storage drain")
    );
    try {
      const next = await refreshSnapshot();
      if (Platform.OS !== "ios") {
        setResult(
          "iosDrain",
          createScenarioResult("passed", "Android uses Headless JS delivery")
        );
        return;
      }
      const passed =
        next.postPrepareLocations > 0 && next.postPrepareLocationEvents > 0;
      setResult(
        "iosDrain",
        createScenarioResult(
          passed ? "passed" : "failed",
          `postPrepareLocations=${next.postPrepareLocations}, postPrepareEvents=${next.postPrepareLocationEvents}`
        )
      );
    } catch (error) {
      setResult("iosDrain", createScenarioResult("failed", shortError(error)));
    }
  };

  const validatePlatformLimits = async () => {
    const message =
      Platform.OS === "ios"
        ? "iOS: no Headless JS or boot receiver; verify storage drain only"
        : "Android: boot/headless/geofence are expected in long-run flow";
    setResult("platformLimits", createScenarioResult("passed", message));
  };

  const runCleanup = async () => {
    setResult("cleanup", createScenarioResult("running", "Stopping tracking"));
    try {
      await stopBackgroundLocation();
      await removeGeofences();
      const next = await refreshSnapshot();
      setResult(
        "cleanup",
        createScenarioResult("passed", `running=${next.running}`)
      );
    } catch (error) {
      setResult("cleanup", createScenarioResult("failed", shortError(error)));
    }
  };

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
