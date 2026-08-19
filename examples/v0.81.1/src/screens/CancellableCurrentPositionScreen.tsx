import React from "react";
import { getCurrentPosition } from "react-native-nitro-geolocation";
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

const PREFIX = "cancellable-current-position";

const initialResults = createScenarioResults([
  "preAborted",
  "isolation"
] as const);

function abortWithReason(controller: AbortController, reason: unknown) {
  (controller.abort as (reason?: unknown) => void)(reason);
}

function assertAbortOutcome(
  error: unknown,
  signal: AbortSignal,
  requestedReason: unknown
): "exact reason" | "AbortError fallback" {
  const runtimeReason = (signal as AbortSignal & { reason?: unknown }).reason;
  if (runtimeReason !== undefined) {
    if (error !== runtimeReason || runtimeReason !== requestedReason) {
      throw new Error("Cancelled request did not preserve signal.reason.");
    }
    return "exact reason";
  }

  if (!(error instanceof Error) || error.name !== "AbortError") {
    throw new Error("Cancelled request did not use an AbortError fallback.");
  }
  return "AbortError fallback";
}

export default function CancellableCurrentPositionScreen() {
  const { permissionStatus, refreshPermission, requestLocationPermission } =
    usePermissionStatus();
  const { results, setResult } = useScenarioResults(initialResults);

  const runPreAbortedScenario = async () => {
    setResult("preAborted", {
      status: "running",
      message: "Rejecting a request whose signal is already aborted"
    });

    const controller = new AbortController();
    const reason = new Error("cancelled before native work");
    abortWithReason(controller, reason);

    try {
      await runWithNativeGeolocation(() =>
        getCurrentPosition({ signal: controller.signal })
      );
      throw new Error("Pre-aborted getCurrentPosition unexpectedly resolved.");
    } catch (error) {
      try {
        const outcome = assertAbortOutcome(error, controller.signal, reason);
        setResult("preAborted", {
          status: "passed",
          message: `Pre-aborted request preserved the ${outcome}.`
        });
      } catch (assertionError) {
        setResult("preAborted", {
          status: "failed",
          message: getDisplayErrorMessage(assertionError)
        });
      }
    } finally {
      await refreshPermission();
    }
  };

  const runIsolationScenario = async () => {
    setResult("isolation", {
      status: "running",
      message: "Starting two native requests and cancelling the first"
    });

    const cancelledController = new AbortController();
    const survivorController = new AbortController();
    const cancellationReason = new Error("cancel only the first request");

    try {
      const permission = await requestLocationPermission();
      if (permission !== "granted") {
        throw new Error(`Permission was not granted: ${permission}`);
      }

      const survivor = await runWithNativeGeolocation(async () => {
        const requestOptions = {
          accuracy: { android: "high" as const, ios: "best" as const },
          maximumAge: 0,
          timeout: 30000
        };
        const cancelledRequest = getCurrentPosition({
          ...requestOptions,
          signal: cancelledController.signal
        });
        const survivingRequest = getCurrentPosition({
          ...requestOptions,
          signal: survivorController.signal
        });

        abortWithReason(cancelledController, cancellationReason);

        try {
          await cancelledRequest;
          throw new Error("Cancelled request unexpectedly resolved.");
        } catch (error) {
          assertAbortOutcome(
            error,
            cancelledController.signal,
            cancellationReason
          );
        }

        setResult("isolation", {
          status: "running",
          message:
            "Cancelled request rejected; move location for surviving request."
        });
        return survivingRequest;
      });

      const coordinates = assertFixtureCoordinates(survivor);
      setResult("isolation", {
        status: "passed",
        message: `Native cancellation cancelled first only; survivor ${coordinates}.`
      });
    } catch (error) {
      setResult("isolation", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      survivorController.abort();
      await refreshPermission();
    }
  };

  return (
    <ScenarioScreen
      prefix={PREFIX}
      title="Cancellable Current Position"
      subtitle="AbortSignal cancellation without cross-request interference"
    >
      <ScenarioSection index={1} title="Permission">
        <PermissionStatusBlock prefix={PREFIX} status={permissionStatus} />
      </ScenarioSection>

      <ScenarioSection index={2} title="Pre-aborted Signal" divided>
        <ScenarioButton
          title="Run Pre-aborted Request"
          onPress={runPreAbortedScenario}
          testID={`${PREFIX}-run-pre-aborted-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="pre-aborted"
          label="Pre-aborted request"
          result={results.preAborted}
        />
      </ScenarioSection>

      <ScenarioSection index={3} title="Concurrent Requests" divided>
        <ScenarioButton
          title="Run Isolated Cancellation"
          onPress={runIsolationScenario}
          color="#7B1FA2"
          testID={`${PREFIX}-run-isolation-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="isolation"
          label="Isolated cancellation"
          result={results.isolation}
        />
      </ScenarioSection>
    </ScenarioScreen>
  );
}
