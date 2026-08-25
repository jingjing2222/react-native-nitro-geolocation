import Geolocation from "react-native-nitro-geolocation/compat";
import type {
  GeolocationResponse,
  GeolocationResponseWithMetadata
} from "react-native-nitro-geolocation/compat";
import { setScenario } from "./dom";
import {
  type ExpectedLocation,
  assertPosition,
  expectedLocations,
  getErrorCode,
  isNearExpected
} from "./locationAssertions";
import { postNativeStatus } from "./nativeBridge";
import { scenarios } from "./scenarios";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runStep<T>(
  id: string,
  action: () => Promise<T>,
  validate: (value: T) => void = () => undefined
) {
  setScenario(id, "running");
  try {
    const result = await action();
    validate(result);
    setScenario(id, "pass", result);
    return result;
  } catch (error) {
    setScenario(id, "fail", error);
    throw error;
  }
}

function getCurrentPositionAsync(options: {
  maximumAge: number;
  timeout: number;
}) {
  return new Promise<GeolocationResponse>((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => reject(error),
      options
    );
  });
}

function getCurrentPositionWithMetadataAsync(options: {
  maximumAge: number;
  timeout: number;
}) {
  return new Promise<GeolocationResponseWithMetadata>((resolve, reject) => {
    Geolocation.getCurrentPosition(resolve, reject, {
      ...options,
      includeExtraMetadata: true
    });
  });
}

function assertDefaultResponseShape(position: GeolocationResponse) {
  const keys = Object.keys(position);
  if (keys.length !== 2 || keys[0] !== "coords" || keys[1] !== "timestamp") {
    throw new Error(`Compat default response shape changed: ${keys.join(",")}`);
  }
}

function assertWebMetadata(position: GeolocationResponseWithMetadata) {
  assertPosition(position);
  const keys = Object.keys(position);
  if (keys.join(",") !== "coords,timestamp,provider") {
    throw new Error(`Unexpected web metadata shape: ${keys.join(",")}`);
  }
  if (position.provider !== "unknown") {
    throw new Error(`Expected web provider unknown, got ${position.provider}.`);
  }
  if (Object.hasOwn(position, "mocked")) {
    throw new Error("Web compat metadata must omit unsupported mocked state.");
  }
}

async function compatGetCurrentPositionUntilSuccess(timeoutMs: number) {
  const startedAt = Date.now();
  const transientErrors: unknown[] = [];

  while (true) {
    try {
      const position = await getCurrentPositionAsync({
        maximumAge: 0,
        timeout: 15000
      });
      return { position, transientErrors };
    } catch (error) {
      transientErrors.push(error);
      const code = getErrorCode(error);
      if ((code !== 2 && code !== 3) || Date.now() - startedAt >= timeoutMs) {
        throw error;
      }
      await wait(500);
    }
  }
}

async function compatGetCurrentPositionUntilExpected({
  expected,
  timeoutMs
}: {
  expected: ExpectedLocation;
  timeoutMs: number;
}) {
  const startedAt = Date.now();
  const transientErrors: unknown[] = [];
  const ignoredPositions: GeolocationResponse[] = [];

  while (true) {
    try {
      const position = await getCurrentPositionAsync({
        maximumAge: 0,
        timeout: 15000
      });
      if (isNearExpected(position, expected)) {
        return { position, transientErrors, ignoredPositions };
      }
      ignoredPositions.push(position);
      if (Date.now() - startedAt >= timeoutMs) {
        const last = ignoredPositions[ignoredPositions.length - 1];
        throw new Error(
          `Compat getCurrentPosition did not return expected coords ${expected.latitude}, ${expected.longitude}. Last observed: ${last?.coords.latitude}, ${last?.coords.longitude} (samples=${ignoredPositions.length}).`
        );
      }
      await wait(500);
    } catch (error) {
      transientErrors.push(error);
      const code = getErrorCode(error);
      if ((code !== 2 && code !== 3) || Date.now() - startedAt >= timeoutMs) {
        throw error;
      }
      await wait(500);
    }
  }
}

async function compatWatchUntilFirstEvent({
  timeoutMs,
  clearOnFirst,
  acceptPosition,
  onStarted,
  includeExtraMetadata = false
}: {
  timeoutMs: number;
  clearOnFirst: boolean;
  acceptPosition: (position: GeolocationResponse) => boolean;
  onStarted?: (watchId: number) => void;
  includeExtraMetadata?: boolean;
}) {
  const events: GeolocationResponse[] = [];
  const errors: unknown[] = [];

  return new Promise<{
    watchId: number;
    events: GeolocationResponse[];
    errors: unknown[];
    position: GeolocationResponse;
  }>((resolve, reject) => {
    let stopped = false;
    let resolved = false;
    let watchId = -1;
    const timeout = window.setTimeout(() => {
      if (stopped || resolved) {
        return;
      }
      stopped = true;
      if (watchId !== -1) {
        Geolocation.clearWatch(watchId);
      }
      reject(
        new Error(
          `Timed out waiting for accepted compat watch event after ${timeoutMs}ms.`
        )
      );
    }, timeoutMs);
    const onPosition = (position: GeolocationResponse) => {
      if (stopped) {
        return;
      }
      events.push(position);
      if (!acceptPosition(position)) {
        return;
      }
      if (resolved) {
        return;
      }
      resolved = true;
      window.clearTimeout(timeout);
      if (clearOnFirst) {
        stopped = true;
        Geolocation.clearWatch(watchId);
      }
      resolve({ watchId, events, errors, position });
    };
    const onError = (error: unknown) => {
      if (stopped || resolved) {
        return;
      }
      errors.push(error);
    };
    watchId = includeExtraMetadata
      ? Geolocation.watchPosition(onPosition, onError, {
          includeExtraMetadata: true,
          maximumAge: 0,
          timeout: 15000
        })
      : Geolocation.watchPosition(onPosition, onError, {
          maximumAge: 0,
          timeout: 15000
        });
    onStarted?.(watchId);
  });
}

export function runCompatApiAvailabilityCheck() {
  setScenario("compat-api-availability", "running");
  const compatShape = {
    getCurrentPosition: typeof Geolocation.getCurrentPosition,
    watchPosition: typeof Geolocation.watchPosition,
    clearWatch: typeof Geolocation.clearWatch,
    stopObserving: typeof Geolocation.stopObserving,
    requestAuthorization: typeof Geolocation.requestAuthorization,
    setRNConfiguration: typeof Geolocation.setRNConfiguration
  };
  const compatReady = Object.values(compatShape).every(
    (type) => type === "function"
  );
  setScenario(
    "compat-api-availability",
    compatReady ? "pass" : "fail",
    compatShape
  );
  if (!compatReady) {
    throw new Error("Compat API browser export is incomplete.");
  }
}

export async function runCompatScenarios() {
  const baseline = await runStep(
    "compat-get-current-position",
    async () => {
      const initial = await compatGetCurrentPositionUntilSuccess(30000);
      setScenario(
        "compat-get-current-position",
        "running",
        { phase: "move-for-compat-get-current-position", baseline: initial },
        "Move device location now; compat getCurrentPosition should return the expected coords."
      );
      return compatGetCurrentPositionUntilExpected({
        expected: expectedLocations.compatGetCurrentPosition,
        timeoutMs: 30000
      });
    },
    (result) => {
      assertPosition(result.position);
      assertDefaultResponseShape(result.position);
    }
  );

  await runStep(
    "compat-metadata-get-current-position",
    () =>
      getCurrentPositionWithMetadataAsync({
        maximumAge: 10000,
        timeout: 15000
      }),
    assertWebMetadata
  );

  await runStep(
    "compat-watch-position",
    async () => {
      const watch = await compatWatchUntilFirstEvent({
        clearOnFirst: false,
        timeoutMs: 30000,
        acceptPosition: (position) =>
          isNearExpected(
            position,
            expectedLocations.compatWatchPositionInitial
          ),
        onStarted: () => {
          setScenario(
            "compat-watch-position",
            "running",
            {
              phase: "move-for-compat-watch-position",
              baseline: baseline.position,
              expected: expectedLocations.compatWatchPositionInitial
            },
            "Move device location now; compat watch should emit the expected coordinate."
          );
        }
      });
      Geolocation.clearWatch(watch.watchId);
      const callbackCountAfterClear = watch.events.length;
      setScenario(
        "compat-watch-position",
        "running",
        {
          phase: "move-after-compat-watch-position",
          watchId: watch.watchId,
          callbackCountAfterClear,
          expected: expectedLocations.compatWatchPositionAfterClear,
          transientErrors: watch.errors
        },
        "Compat watch emitted once and was cleared. Move device location now; a one-shot probe should see it without extra watch callbacks."
      );
      const probeAfterClear = await compatGetCurrentPositionUntilExpected({
        expected: expectedLocations.compatWatchPositionAfterClear,
        timeoutMs: 30000
      });
      return {
        watchId: watch.watchId,
        transientErrors: watch.errors,
        probeAfterClear,
        callbackCountAfterClear,
        callbackCount: watch.events.length,
        sample: watch.position
      };
    },
    (result) => {
      assertPosition(result.sample);
      if (result.callbackCountAfterClear < 1) {
        throw new Error(
          "Expected compat watch scenario to prove an active watch."
        );
      }
      if (result.callbackCount !== result.callbackCountAfterClear) {
        throw new Error(
          `Expected clearWatch to prevent callbacks, got ${result.callbackCount}.`
        );
      }
    }
  );

  await runStep(
    "compat-stop-observing",
    async () => {
      let startedWatchCount = 0;
      const requestInitialMove = () => {
        startedWatchCount += 1;
        if (startedWatchCount !== 2) {
          return;
        }
        setScenario(
          "compat-stop-observing",
          "running",
          {
            phase: "move-for-compat-stop-observing-initial",
            baseline: baseline.position,
            expected: expectedLocations.compatStopObservingInitial
          },
          "Move device location now; both compat watchers should emit the expected coordinate before stopObserving."
        );
      };
      const [firstWatch, secondWatch] = await Promise.all([
        compatWatchUntilFirstEvent({
          clearOnFirst: false,
          timeoutMs: 30000,
          acceptPosition: (position) =>
            isNearExpected(
              position,
              expectedLocations.compatStopObservingInitial
            ),
          onStarted: requestInitialMove
        }),
        compatWatchUntilFirstEvent({
          clearOnFirst: false,
          timeoutMs: 30000,
          acceptPosition: (position) =>
            isNearExpected(
              position,
              expectedLocations.compatStopObservingInitial
            ),
          onStarted: requestInitialMove
        })
      ]);
      Geolocation.stopObserving();
      const callbackCountAfterStop =
        firstWatch.events.length + secondWatch.events.length;
      setScenario(
        "compat-stop-observing",
        "running",
        {
          phase: "move-after-compat-stop-observing",
          firstWatchId: firstWatch.watchId,
          secondWatchId: secondWatch.watchId,
          callbackCountAfterStop,
          expected: expectedLocations.compatStopObservingAfterClear,
          transientErrors: [...firstWatch.errors, ...secondWatch.errors]
        },
        "Both compat watches emitted once and stopObserving cleared them. Move device location now; a one-shot probe should see it without extra watch callbacks."
      );
      const probeAfterStop = await compatGetCurrentPositionUntilExpected({
        expected: expectedLocations.compatStopObservingAfterClear,
        timeoutMs: 30000
      });
      return {
        firstWatchId: firstWatch.watchId,
        secondWatchId: secondWatch.watchId,
        transientErrors: [...firstWatch.errors, ...secondWatch.errors],
        probeAfterStop,
        callbackCountAfterStop,
        callbackCount: firstWatch.events.length + secondWatch.events.length
      };
    },
    (result) => {
      if (result.callbackCountAfterStop < 2) {
        throw new Error(
          "Expected compat stopObserving scenario to prove active watches."
        );
      }
      if (result.callbackCount !== result.callbackCountAfterStop) {
        throw new Error(
          `Expected stopObserving to prevent callbacks, got ${result.callbackCount}.`
        );
      }
    }
  );

  await runStep(
    "compat-metadata-watch-position",
    () =>
      compatWatchUntilFirstEvent({
        clearOnFirst: true,
        timeoutMs: 30000,
        includeExtraMetadata: true,
        acceptPosition: (position) =>
          isNearExpected(position, expectedLocations.compatMetadataWatch),
        onStarted: () => {
          setScenario(
            "compat-metadata-watch-position",
            "running",
            {
              phase: "move-for-compat-metadata-watch-position",
              expected: expectedLocations.compatMetadataWatch
            },
            "Move device location now; the opted-in compat watch should expose web metadata."
          );
        }
      }),
    (result) =>
      assertWebMetadata(result.position as GeolocationResponseWithMetadata)
  );
}

export async function runCompatSuite() {
  runCompatApiAvailabilityCheck();
  await runCompatScenarios();

  const failedScenarios = scenarios.filter(
    (scenario) =>
      [
        "compat-api-availability",
        "compat-get-current-position",
        "compat-metadata-get-current-position",
        "compat-watch-position",
        "compat-stop-observing",
        "compat-metadata-watch-position"
      ].includes(scenario.id) && scenario.status !== "pass"
  );
  if (failedScenarios.length > 0) {
    throw new Error(
      `Compat suite incomplete: ${failedScenarios
        .map((scenario) => scenario.id)
        .join(", ")}`
    );
  }
  postNativeStatus("compat-suite", "pass");
}
