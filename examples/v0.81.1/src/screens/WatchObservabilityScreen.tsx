import React, { useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import {
  type ActiveWatch,
  getActiveWatches,
  requestPermission,
  stopObserving,
  unwatch,
  watchPosition
} from "react-native-nitro-geolocation";
import {
  ResultBlock,
  ScenarioButton,
  ScenarioScreen,
  ScenarioSection,
  createScenarioResults,
  getDisplayErrorMessage,
  useScenarioResults
} from "./scenario";

const PREFIX = "watch-observability";
const initialResults = createScenarioResults([
  "refresh",
  "start",
  "removal",
  "stop"
] as const);

export default function WatchObservabilityScreen() {
  const { results, setResult } = useScenarioResults(initialResults);
  const ownedTokensRef = useRef<string[]>([]);
  const mountedRef = useRef(true);
  const startInFlightRef = useRef(false);
  const startGenerationRef = useRef(0);
  const [watches, setWatches] = useState<ActiveWatch[]>([]);
  const [updates, setUpdates] = useState(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      startGenerationRef.current += 1;
      for (const token of ownedTokensRef.current) {
        unwatch(token);
      }
      ownedTokensRef.current = [];
    };
  }, []);

  const refreshSnapshot = () => {
    const snapshot = getActiveWatches();
    setWatches(snapshot);
    return snapshot;
  };

  const inspectIdleState = () => {
    const snapshot = refreshSnapshot();
    setResult("refresh", {
      status: snapshot.length === 0 ? "passed" : "failed",
      message:
        snapshot.length === 0
          ? "No Modern API watches are active."
          : `Found ${snapshot.length} active watch(es).`
    });
  };

  const startTwoPositionWatches = async () => {
    if (startInFlightRef.current || ownedTokensRef.current.length > 0) {
      setResult("start", {
        status: "failed",
        message: "Stop the current example watches before starting again."
      });
      return;
    }

    startInFlightRef.current = true;
    const generation = ++startGenerationRef.current;
    setResult("start", {
      status: "running",
      message: "Requesting permission and starting two position watches"
    });

    try {
      const permission = await requestPermission();
      if (!mountedRef.current || generation !== startGenerationRef.current) {
        return;
      }
      if (permission !== "granted") {
        throw new Error(`Permission was not granted: ${permission}`);
      }

      const onPosition = () => {
        if (mountedRef.current) {
          setUpdates((current) => current + 1);
        }
      };
      const onError = (error: { message: string }) => {
        if (mountedRef.current) {
          setResult("start", { status: "failed", message: error.message });
        }
      };

      const firstToken = watchPosition(onPosition, onError, {
        accuracy: { android: "high", ios: "best" },
        distanceFilter: 0
      });
      const secondToken = watchPosition(onPosition, onError, {
        accuracy: { android: "balanced", ios: "hundredMeters" },
        distanceFilter: 50
      });
      ownedTokensRef.current = [firstToken, secondToken];

      const snapshot = refreshSnapshot();
      const ownedWatches = snapshot.filter(({ token }) =>
        ownedTokensRef.current.includes(token)
      );
      if (
        ownedWatches.length !== 2 ||
        ownedWatches.some(({ kind }) => kind !== "position")
      ) {
        throw new Error("The native snapshot did not contain both watches.");
      }

      setResult("start", {
        status: "passed",
        message:
          "Both position watch tokens are visible in the native snapshot."
      });
    } catch (error) {
      for (const token of ownedTokensRef.current) {
        unwatch(token);
      }
      ownedTokensRef.current = [];
      if (mountedRef.current) {
        refreshSnapshot();
        setResult("start", {
          status: "failed",
          message: getDisplayErrorMessage(error)
        });
      }
    } finally {
      startInFlightRef.current = false;
    }
  };

  const removeFirstWatchTwice = () => {
    const firstToken = ownedTokensRef.current[0];
    if (!firstToken) {
      setResult("removal", {
        status: "failed",
        message: "Start the example watches before removing one."
      });
      return;
    }

    unwatch(firstToken);
    unwatch(firstToken);
    unwatch("watch-token-that-does-not-exist");
    ownedTokensRef.current = ownedTokensRef.current.slice(1);

    const snapshot = refreshSnapshot();
    const remainingOwned = snapshot.filter(({ token }) =>
      ownedTokensRef.current.includes(token)
    );
    setResult("removal", {
      status: remainingOwned.length === 1 ? "passed" : "failed",
      message:
        remainingOwned.length === 1
          ? "Repeated and unknown-token cleanup were safe; one watch remains."
          : `Expected one owned watch, found ${remainingOwned.length}.`
    });
  };

  const stopAllWatches = () => {
    startGenerationRef.current += 1;
    stopObserving();
    ownedTokensRef.current = [];
    const snapshot = refreshSnapshot();
    setResult("stop", {
      status: snapshot.length === 0 ? "passed" : "failed",
      message:
        snapshot.length === 0
          ? "stopObserving removed every Modern API watch."
          : `${snapshot.length} watch(es) remained after stopObserving.`
    });
  };

  const positionCount = watches.filter(
    ({ kind }) => kind === "position"
  ).length;
  const headingCount = watches.filter(({ kind }) => kind === "heading").length;

  return (
    <ScenarioScreen
      prefix={PREFIX}
      title="Watch Observability"
      subtitle="Inspect active Modern API position and heading watches"
    >
      <ScenarioSection index={1} title="Snapshot">
        <ScenarioButton
          title="Inspect Idle State"
          onPress={inspectIdleState}
          testID={`${PREFIX}-refresh-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="refresh"
          label="Idle snapshot"
          result={results.refresh}
        />
        <Text testID={`${PREFIX}-active-count`}>Active: {watches.length}</Text>
        <Text testID={`${PREFIX}-position-count`}>
          Position: {positionCount}
        </Text>
        <Text testID={`${PREFIX}-heading-count`}>Heading: {headingCount}</Text>
        <Text testID={`${PREFIX}-update-count`}>
          Updates observed: {updates}
        </Text>
      </ScenarioSection>

      <ScenarioSection index={2} title="Happy path" divided>
        <ScenarioButton
          title="Start Two Position Watches"
          onPress={startTwoPositionWatches}
          color="#2E7D32"
          testID={`${PREFIX}-start-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="start"
          label="Start watches"
          result={results.start}
        />
      </ScenarioSection>

      <ScenarioSection index={3} title="Cleanup edges" divided>
        <ScenarioButton
          title="Remove First Watch Twice"
          onPress={removeFirstWatchTwice}
          color="#D84315"
          testID={`${PREFIX}-remove-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="removal"
          label="Repeated removal"
          result={results.removal}
        />
        <ScenarioButton
          title="Stop All Watches"
          onPress={stopAllWatches}
          color="#616161"
          testID={`${PREFIX}-stop-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="stop"
          label="Stop all"
          result={results.stop}
        />
      </ScenarioSection>
    </ScenarioScreen>
  );
}
