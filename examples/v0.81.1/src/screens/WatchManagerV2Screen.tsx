import React, { useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import {
  getActiveWatches,
  requestPermission,
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

const PREFIX = "watch-manager-v2";
const initialResults = createScenarioResults([
  "start",
  "baseline",
  "near",
  "far",
  "cleanup",
  "remaining"
] as const);
type Counts = { eager: number; filtered: number };

export default function WatchManagerV2Screen() {
  const { results, setResult } = useScenarioResults(initialResults);
  const tokensRef = useRef<{ eager?: string; filtered?: string }>({});
  const countsRef = useRef<Counts>({ eager: 0, filtered: 0 });
  const baselineRef = useRef<Counts | undefined>(undefined);
  const nearRef = useRef<Counts | undefined>(undefined);
  const cleanupRef = useRef<Counts | undefined>(undefined);
  const mountedRef = useRef(true);
  const [counts, setCounts] = useState(countsRef.current);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      for (const token of Object.values(tokensRef.current)) {
        if (token) unwatch(token);
      }
      tokensRef.current = {};
    };
  }, []);

  const recordUpdate = (kind: keyof Counts) => {
    if (!mountedRef.current) return;
    const next = { ...countsRef.current, [kind]: countsRef.current[kind] + 1 };
    countsRef.current = next;
    setCounts(next);
    if (next.eager > 0 && next.filtered > 0) {
      setResult("start", {
        status: "passed",
        message: "Both independent watches received their initial position."
      });
    }
  };

  const startWatches = async () => {
    if (Object.values(tokensRef.current).some(Boolean)) {
      setResult("start", {
        status: "failed",
        message: "Clean up the current watches before starting again."
      });
      return;
    }

    setResult("start", {
      status: "running",
      message: "Requesting permission and waiting for both initial positions"
    });
    try {
      const permission = await requestPermission();
      if (permission !== "granted") {
        throw new Error(`Permission was not granted: ${permission}`);
      }
      const onError = (error: { message: string }) => {
        if (mountedRef.current) {
          setResult("start", { status: "failed", message: error.message });
        }
      };
      tokensRef.current.eager = watchPosition(
        () => recordUpdate("eager"),
        onError,
        { distanceFilter: 0, interval: 100, fastestInterval: 100 }
      );
      tokensRef.current.filtered = watchPosition(
        () => recordUpdate("filtered"),
        onError,
        { distanceFilter: 500, interval: 100, fastestInterval: 100 }
      );
    } catch (error) {
      setResult("start", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    }
  };

  const captureBaseline = () => {
    const current = countsRef.current;
    const ready = current.eager > 0 && current.filtered > 0;
    if (ready) baselineRef.current = { ...current };
    setResult("baseline", {
      status: ready ? "passed" : "failed",
      message: ready
        ? "Captured both subscription baselines."
        : "Wait for both initial watch callbacks."
    });
  };

  const verifyNearUpdate = () => {
    const baseline = baselineRef.current;
    const current = countsRef.current;
    const passed =
      baseline !== undefined &&
      current.eager > baseline.eager &&
      current.filtered === baseline.filtered;
    if (passed) nearRef.current = { ...current };
    setResult("near", {
      status: passed ? "passed" : "failed",
      message: passed
        ? "The eager watch advanced while the 500 m watch stayed filtered."
        : "Expected only the eager watch to advance after the near move."
    });
  };

  const verifyFarUpdate = () => {
    const near = nearRef.current;
    const current = countsRef.current;
    const passed =
      near !== undefined &&
      current.eager > near.eager &&
      current.filtered > near.filtered;
    setResult("far", {
      status: passed ? "passed" : "failed",
      message: passed
        ? "Both watches advanced after crossing the 500 m threshold."
        : "Expected both watches to advance after the far move."
    });
  };

  const removeEagerWatch = () => {
    const eagerToken = tokensRef.current.eager;
    if (!eagerToken) {
      setResult("cleanup", {
        status: "failed",
        message: "The eager watch is not active."
      });
      return;
    }
    unwatch(eagerToken);
    unwatch(eagerToken);
    unwatch("watch-manager-v2-unknown-token");
    tokensRef.current.eager = undefined;
    cleanupRef.current = { ...countsRef.current };
    const filteredToken = tokensRef.current.filtered;
    const active = getActiveWatches();
    const passed =
      filteredToken !== undefined &&
      active.some(({ token }) => token === filteredToken) &&
      !active.some(({ token }) => token === eagerToken);
    setResult("cleanup", {
      status: passed ? "passed" : "failed",
      message: passed
        ? "Repeated cleanup removed only the eager watch."
        : "Cleanup did not leave exactly the owned filtered watch."
    });
  };

  const verifyRemainingWatch = () => {
    const baseline = cleanupRef.current;
    const current = countsRef.current;
    const passed =
      baseline !== undefined &&
      current.eager === baseline.eager &&
      current.filtered > baseline.filtered;
    const filteredToken = tokensRef.current.filtered;
    if (filteredToken) unwatch(filteredToken);
    tokensRef.current.filtered = undefined;
    const fullyCleaned = getActiveWatches().length === 0;
    setResult("remaining", {
      status: passed && fullyCleaned ? "passed" : "failed",
      message:
        passed && fullyCleaned
          ? "The remaining watch delivered, then all resources stopped."
          : "The removed watch fired again or final cleanup was incomplete."
    });
  };

  return (
    <ScenarioScreen
      prefix={PREFIX}
      title="Watch Manager v2"
      subtitle="Independent delivery thresholds and exact cleanup"
    >
      <ScenarioSection index={1} title="Start independent watches">
        <ScenarioButton
          title="Start Eager + 500 m Watches"
          onPress={startWatches}
          testID={`${PREFIX}-start-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="start"
          label="Initial delivery"
          result={results.start}
        />
        <Text testID={`${PREFIX}-eager-count`}>
          Eager updates: {counts.eager}
        </Text>
        <Text testID={`${PREFIX}-filtered-count`}>
          Filtered updates: {counts.filtered}
        </Text>
        <ScenarioButton
          title="Capture Baseline"
          onPress={captureBaseline}
          testID={`${PREFIX}-baseline-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="baseline"
          label="Baseline"
          result={results.baseline}
        />
      </ScenarioSection>

      <ScenarioSection index={2} title="Per-watch filtering" divided>
        <ScenarioButton
          title="Verify Near Move"
          onPress={verifyNearUpdate}
          testID={`${PREFIX}-near-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="near"
          label="Near move"
          result={results.near}
        />
        <ScenarioButton
          title="Verify Far Move"
          onPress={verifyFarUpdate}
          testID={`${PREFIX}-far-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="far"
          label="Far move"
          result={results.far}
        />
      </ScenarioSection>

      <ScenarioSection index={3} title="Cleanup isolation" divided>
        <ScenarioButton
          title="Remove Eager Watch Twice"
          onPress={removeEagerWatch}
          testID={`${PREFIX}-cleanup-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="cleanup"
          label="Selective cleanup"
          result={results.cleanup}
        />
        <ScenarioButton
          title="Verify Remaining + Stop"
          onPress={verifyRemainingWatch}
          testID={`${PREFIX}-remaining-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="remaining"
          label="Remaining watch"
          result={results.remaining}
        />
      </ScenarioSection>
    </ScenarioScreen>
  );
}
