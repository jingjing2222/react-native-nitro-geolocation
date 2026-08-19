import React, { useRef } from "react";
import {
  type GeolocationResponse,
  type LocationResponseSource,
  getCurrentPosition,
  getLastKnownPosition
} from "react-native-nitro-geolocation";
import {
  PermissionStatusBlock,
  ResultBlock,
  ScenarioButton,
  ScenarioScreen,
  ScenarioSection,
  assertFixtureCoordinates,
  createScenarioResults,
  getDisplayErrorMessage,
  runWithNativeGeolocation,
  usePermissionStatus,
  useScenarioResults
} from "./scenario";

const PREFIX = "location-quality-metadata";
const initialResults = createScenarioResults(["live", "cache"] as const);

function readMetadata(
  position: GeolocationResponse,
  source: LocationResponseSource
) {
  const metadata = position.metadata;
  if (!metadata) {
    throw new Error("Location response did not include metadata.");
  }
  if (metadata.source !== source) {
    throw new Error(
      `Expected ${source} metadata source, received ${metadata.source}.`
    );
  }
  if (
    metadata.age === undefined ||
    !Number.isFinite(metadata.age) ||
    metadata.age < 0
  ) {
    throw new Error(`Location age was invalid: ${String(metadata.age)}.`);
  }
  if (
    !(["high", "medium", "low", "unknown"] as const).includes(metadata.quality)
  ) {
    throw new Error(`Location quality was invalid: ${metadata.quality}.`);
  }
  return metadata;
}

export default function LocationQualityMetadataScreen() {
  const { permissionStatus, refreshPermission, requestLocationPermission } =
    usePermissionStatus();
  const { results, setResult } = useScenarioResults(initialResults);
  const latestLivePosition = useRef<GeolocationResponse | undefined>(undefined);

  const runLiveScenario = async () => {
    setResult("live", {
      status: "running",
      message: "Requesting a normal native position with descriptive metadata"
    });

    try {
      const status = await requestLocationPermission();
      if (status !== "granted") {
        throw new Error(`Permission was not granted: ${status}`);
      }

      const position = await runWithNativeGeolocation(() =>
        getCurrentPosition({
          accuracy: { android: "high", ios: "best" },
          maximumAge: 30_000,
          timeout: 15_000
        })
      );
      const coordinates = assertFixtureCoordinates(position);
      const metadata = readMetadata(position, "currentPosition");
      if (metadata.staleReason !== undefined) {
        throw new Error(
          `Fresh current position was unexpectedly stale: ${metadata.staleReason}.`
        );
      }
      latestLivePosition.current = position;

      setResult("live", {
        status: "passed",
        message: `${coordinates}; source=${metadata.source}; age=${metadata.age}ms; quality=${metadata.quality}; stale=${metadata.staleReason ?? "none"}.`
      });
    } catch (error) {
      setResult("live", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      await refreshPermission();
    }
  };

  const runCacheScenario = async () => {
    setResult("cache", {
      status: "running",
      message: "Reading the same observed position from the synchronous cache"
    });

    try {
      const live = latestLivePosition.current;
      if (!live) {
        throw new Error(
          "Request a live position before reading its module cache."
        );
      }

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 250);
      });
      const cached = getLastKnownPosition();
      if (!cached) {
        throw new Error(
          "Observed module cache unexpectedly returned undefined."
        );
      }
      const metadata = readMetadata(cached, "moduleCache");
      const liveAge = live.metadata?.age ?? 0;
      if (cached.timestamp !== live.timestamp) {
        throw new Error(
          "Module cache did not return the observed live position."
        );
      }
      if ((metadata.age ?? 0) < liveAge) {
        throw new Error("Module cache age moved backwards.");
      }

      setResult("cache", {
        status: "passed",
        message: `Same timestamp; source=${metadata.source}; age advanced from ${liveAge}ms to ${metadata.age}ms; quality=${metadata.quality}.`
      });
    } catch (error) {
      setResult("cache", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    }
  };

  return (
    <ScenarioScreen
      prefix={PREFIX}
      title="Location Quality Metadata"
      subtitle="Observe delivery source, age, quality, and stale reason without filtering positions"
    >
      <ScenarioSection index={1} title="Permission">
        <PermissionStatusBlock prefix={PREFIX} status={permissionStatus} />
      </ScenarioSection>

      <ScenarioSection index={2} title="Live Position" divided>
        <ScenarioButton
          title="Request Live Position"
          onPress={runLiveScenario}
          testID={`${PREFIX}-run-live-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="live"
          label="Live metadata"
          result={results.live}
        />
      </ScenarioSection>

      <ScenarioSection index={3} title="Observed Cache" divided>
        <ScenarioButton
          title="Read Observed Cache"
          onPress={runCacheScenario}
          color="#00897B"
          testID={`${PREFIX}-run-cache-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="cache"
          label="Cache metadata"
          result={results.cache}
        />
      </ScenarioSection>
    </ScenarioScreen>
  );
}
