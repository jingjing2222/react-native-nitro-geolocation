import {
  type GeolocationResponse,
  LocationErrorCode,
  type PermissionStatus,
  checkPermission,
  getCurrentPosition,
  getLastKnownPosition,
  getLastKnownPositionAsync,
  requestLocationSettings,
  requestPermission,
  stopObserving,
  unwatch,
  watchPosition
} from "react-native-nitro-geolocation";
import {
  assertModernApiAvailability,
  expectSatisfiedLocationSettings
} from "./apiAssertions";
import {
  runCompatApiAvailabilityCheck,
  runCompatScenarios
} from "./compatRunner";
import { setScenario } from "./dom";
import {
  expectCacheMiss,
  expectLatestCachedPosition,
  expectValidCachedPosition
} from "./lastKnownAssertions";
import {
  type ExpectedLocation,
  assertModernPosition,
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

async function watchUntilFirstEvent({
  timeoutMs,
  clearOnFirst,
  acceptPosition = () => true,
  onStarted
}: {
  timeoutMs: number;
  clearOnFirst: boolean;
  acceptPosition?: (position: GeolocationResponse) => boolean;
  onStarted?: (token: string) => void;
}) {
  const startedAt = Date.now();
  const events: GeolocationResponse[] = [];
  const errors: unknown[] = [];

  return new Promise<{
    token: string;
    events: GeolocationResponse[];
    errors: unknown[];
    position: GeolocationResponse;
  }>((resolve, reject) => {
    let activeToken = "";
    let stopped = false;
    let resolved = false;
    const fail = (error: unknown, tokenToClear = activeToken) => {
      if (stopped || resolved) {
        return;
      }
      stopped = true;
      window.clearTimeout(timeout);
      if (tokenToClear) {
        unwatch(tokenToClear);
      }
      reject(error);
    };
    const pass = (token: string, position: GeolocationResponse) => {
      if (resolved) {
        return;
      }
      resolved = true;
      window.clearTimeout(timeout);
      if (clearOnFirst) {
        stopped = true;
        unwatch(token);
      }
      resolve({ token, events, errors, position });
    };
    const timeout = window.setTimeout(() => {
      fail(
        new Error(
          `Timed out waiting for accepted watch event after ${timeoutMs}ms.`
        )
      );
    }, timeoutMs);
    const startWatch = () => {
      if (stopped || resolved) {
        return;
      }
      let token = "";
      token = watchPosition(
        (nextPosition) => {
          if (stopped) {
            return;
          }
          events.push(nextPosition);
          if (!acceptPosition(nextPosition)) {
            return;
          }
          pass(token, nextPosition);
        },
        (error) => {
          if (stopped) {
            return;
          }
          errors.push(error);
          if (resolved) {
            return;
          }
          if (token) {
            unwatch(token);
          }
          if (Date.now() - startedAt >= timeoutMs) {
            fail(error, "");
            return;
          }
          window.setTimeout(startWatch, 500);
        },
        { maximumAge: 0, timeout: 15000 }
      );
      activeToken = token;
      onStarted?.(token);
    };

    startWatch();
  });
}

async function getCurrentPositionUntilSuccess(timeoutMs: number) {
  const startedAt = Date.now();
  const transientErrors: unknown[] = [];

  while (true) {
    try {
      const position = await getCurrentPosition({
        maximumAge: 0,
        timeout: 15000
      });
      return { position, transientErrors };
    } catch (error) {
      transientErrors.push(error);
      const code = getErrorCode(error);
      if (
        (code !== LocationErrorCode.POSITION_UNAVAILABLE &&
          code !== LocationErrorCode.TIMEOUT) ||
        Date.now() - startedAt >= timeoutMs
      ) {
        throw error;
      }
      await wait(500);
    }
  }
}

async function getCurrentPositionUntilExpected({
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
      const position = await getCurrentPosition({
        maximumAge: 0,
        timeout: 15000
      });
      if (isNearExpected(position, expected)) {
        return { position, transientErrors, ignoredPositions };
      }
      ignoredPositions.push(position);
      if (Date.now() - startedAt >= timeoutMs) {
        throw new Error(
          `getCurrentPosition did not return expected coords ${expected.latitude}, ${expected.longitude}.`
        );
      }
      await wait(500);
    } catch (error) {
      transientErrors.push(error);
      const code = getErrorCode(error);
      if (
        (code !== LocationErrorCode.POSITION_UNAVAILABLE &&
          code !== LocationErrorCode.TIMEOUT) ||
        Date.now() - startedAt >= timeoutMs
      ) {
        throw error;
      }
      await wait(500);
    }
  }
}

export async function runSuccessSuite() {
  assertModernApiAvailability();

  runCompatApiAvailabilityCheck();

  await runStep(
    "request-location-settings",
    () => requestLocationSettings(),
    expectSatisfiedLocationSettings
  );

  await runStep(
    "last-known-cold-cache",
    async () => getLastKnownPosition(),
    (cached) =>
      expectCacheMiss(cached, "Cold browser module cache should be empty.")
  );

  await runStep(
    "last-known-async-cold-cache",
    () => getLastKnownPositionAsync(),
    (cached) =>
      expectCacheMiss(
        cached,
        "Cold async browser module cache should be empty."
      )
  );

  await runStep<PermissionStatus>(
    "check-permission",
    () => checkPermission(),
    (status) => {
      if (
        !["granted", "denied", "restricted", "undetermined"].includes(status)
      ) {
        throw new Error(`Unexpected permission status: ${status}`);
      }
    }
  );

  await runStep<PermissionStatus>(
    "request-permission",
    () => requestPermission(),
    (status) => {
      if (status !== "granted") {
        throw new Error(`Expected granted permission, got ${status}.`);
      }
    }
  );

  const position = await runStep(
    "get-current-position",
    async () => {
      const baseline = await getCurrentPositionUntilSuccess(30000);
      setScenario(
        "get-current-position",
        "running",
        { phase: "move-for-get-current-position", baseline },
        "Move device location now; one-shot getCurrentPosition should return real coords."
      );
      return getCurrentPositionUntilExpected({
        expected: expectedLocations.getCurrentPosition,
        timeoutMs: 30000
      });
    },
    (result) => assertModernPosition(result.position, "currentPosition")
  );

  await runStep(
    "last-known-module-cache",
    async () => getLastKnownPosition(),
    (cached) =>
      expectLatestCachedPosition(
        cached,
        position.position.timestamp,
        (cached) => assertModernPosition(cached, "moduleCache")
      )
  );

  await runStep(
    "last-known-async-cache",
    () => getLastKnownPositionAsync({ maximumAge: 30_000 }),
    (cached) =>
      expectValidCachedPosition(
        cached,
        "Async browser module cache did not return a position.",
        (cached) => assertModernPosition(cached, "moduleCache")
      )
  );

  await runStep(
    "last-known-stale-cache",
    () => getLastKnownPositionAsync({ maximumAge: 0 }),
    (cached) =>
      expectCacheMiss(cached, "maximumAge=0 should reject the observed cache.")
  );

  await runStep(
    "watch-position",
    async () => {
      return watchUntilFirstEvent({
        clearOnFirst: true,
        timeoutMs: 30000,
        acceptPosition: (nextPosition) =>
          isNearExpected(nextPosition, expectedLocations.watchPosition),
        onStarted: () => {
          setScenario(
            "watch-position",
            "running",
            {
              phase: "move-for-watch-position",
              baseline: position.position,
              expected: expectedLocations.watchPosition
            },
            "Move device location now; the browser watch should emit the expected coordinate."
          );
        }
      });
    },
    (result) => assertModernPosition(result.position, "watchPosition")
  );

  await runStep(
    "unwatch",
    async () => {
      const unwatchBaseline = await getCurrentPositionUntilSuccess(30000);
      const { token, events, errors } = await watchUntilFirstEvent({
        clearOnFirst: false,
        timeoutMs: 30000,
        acceptPosition: (nextPosition) =>
          isNearExpected(nextPosition, expectedLocations.unwatchInitial),
        onStarted: () => {
          setScenario(
            "unwatch",
            "running",
            {
              phase: "move-for-unwatch-initial",
              baseline: unwatchBaseline.position,
              expected: expectedLocations.unwatchInitial
            },
            "Move device location now; the watcher should emit the expected coordinate before unwatch."
          );
        }
      });
      unwatch(token);
      const callbackCountAfterUnwatch = events.length;
      setScenario(
        "unwatch",
        "running",
        {
          phase: "move-after-unwatch",
          token,
          callbackCountAfterUnwatch,
          expected: expectedLocations.unwatchAfterClear,
          transientErrors: errors
        },
        "Watcher emitted once and token was cleared. Move device location now; a one-shot probe should see it without extra watch callbacks."
      );
      const probeAfterUnwatch = await getCurrentPositionUntilExpected({
        expected: expectedLocations.unwatchAfterClear,
        timeoutMs: 30000
      });
      return {
        token,
        transientErrors: errors,
        probeAfterUnwatch,
        callbackCountAfterUnwatch,
        callbackCount: events.length
      };
    },
    (result) => {
      if (result.callbackCountAfterUnwatch < 1) {
        throw new Error("Expected unwatch scenario to prove an active watch.");
      }
      if (result.callbackCount !== result.callbackCountAfterUnwatch) {
        throw new Error(
          `Expected unwatch to prevent callbacks, got ${result.callbackCount}.`
        );
      }
    }
  );

  await runStep(
    "stop-observing",
    async () => {
      const stopBaseline = await getCurrentPositionUntilSuccess(30000);
      let startedWatchCount = 0;
      const postStopInitialMoveRequest = () => {
        startedWatchCount += 1;
        if (startedWatchCount !== 2) {
          return;
        }
        setScenario(
          "stop-observing",
          "running",
          {
            phase: "move-for-stop-observing-initial",
            baseline: stopBaseline.position,
            expected: expectedLocations.stopObservingInitial
          },
          "Move device location now; both watchers should emit the expected coordinate before stopObserving."
        );
      };
      const [firstWatch, secondWatch] = await Promise.all([
        watchUntilFirstEvent({
          clearOnFirst: false,
          timeoutMs: 30000,
          acceptPosition: (nextPosition) =>
            isNearExpected(
              nextPosition,
              expectedLocations.stopObservingInitial
            ),
          onStarted: postStopInitialMoveRequest
        }),
        watchUntilFirstEvent({
          clearOnFirst: false,
          timeoutMs: 30000,
          acceptPosition: (nextPosition) =>
            isNearExpected(
              nextPosition,
              expectedLocations.stopObservingInitial
            ),
          onStarted: postStopInitialMoveRequest
        })
      ]);
      stopObserving();
      const callbackCountAfterStop =
        firstWatch.events.length + secondWatch.events.length;
      setScenario(
        "stop-observing",
        "running",
        {
          phase: "move-after-stop-observing",
          firstToken: firstWatch.token,
          secondToken: secondWatch.token,
          callbackCountAfterStop,
          expected: expectedLocations.stopObservingAfterClear,
          transientErrors: [...firstWatch.errors, ...secondWatch.errors]
        },
        "Both watches emitted once and stopObserving cleared them. Move device location now; a one-shot probe should see it without extra watch callbacks."
      );
      const probeAfterStopObserving = await getCurrentPositionUntilExpected({
        expected: expectedLocations.stopObservingAfterClear,
        timeoutMs: 30000
      });
      return {
        firstToken: firstWatch.token,
        secondToken: secondWatch.token,
        transientErrors: [...firstWatch.errors, ...secondWatch.errors],
        probeAfterStopObserving,
        callbackCountAfterStop,
        callbackCount: firstWatch.events.length + secondWatch.events.length,
        baseline: position.position
      };
    },
    (result) => {
      if (result.callbackCountAfterStop < 2) {
        throw new Error(
          "Expected stopObserving scenario to prove active watches."
        );
      }
      if (result.callbackCount !== result.callbackCountAfterStop) {
        throw new Error(
          `Expected stopObserving to prevent callbacks, got ${result.callbackCount}.`
        );
      }
    }
  );

  await runCompatScenarios();

  const failedScenarios = scenarios.filter(
    (scenario) =>
      [
        "api-availability",
        "compat-api-availability",
        "request-location-settings",
        "check-permission",
        "request-permission",
        "get-current-position",
        "last-known-cold-cache",
        "last-known-async-cold-cache",
        "last-known-module-cache",
        "last-known-async-cache",
        "last-known-stale-cache",
        "watch-position",
        "unwatch",
        "stop-observing",
        "compat-get-current-position",
        "compat-watch-position",
        "compat-stop-observing"
      ].includes(scenario.id) && scenario.status !== "pass"
  );
  if (failedScenarios.length > 0) {
    throw new Error(
      `Success suite incomplete: ${failedScenarios
        .map((scenario) => scenario.id)
        .join(", ")}`
    );
  }
  postNativeStatus("success-suite", "pass");
}
