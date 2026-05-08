import React from "react";
import { Platform } from "react-native";
import {
  LocationErrorCode,
  getAccuracyAuthorization,
  requestTemporaryFullAccuracy
} from "react-native-nitro-geolocation";
import {
  PermissionStatusBlock,
  ResultBlock,
  ScenarioButton,
  ScenarioScreen,
  ScenarioSection,
  assertGrantedAccuracyAuthorization,
  assertKnownAccuracyAuthorization,
  assertLocationErrorCode,
  createScenarioResults,
  getDisplayErrorMessage,
  usePermissionStatus,
  useScenarioResults
} from "./scenario";

const PREFIX = "ios-accuracy-authorization";
const TEMPORARY_PURPOSE_KEY = "PreciseE2E";

const initialResults = createScenarioResults([
  "read",
  "temporary",
  "invalid",
  "denied"
] as const);

export default function IOSAccuracyAuthorizationScreen() {
  const { permissionStatus, refreshPermission, requestLocationPermission } =
    usePermissionStatus();
  const { results, setResult } = useScenarioResults(initialResults);

  const ensureIOS = () => {
    if (Platform.OS !== "ios") {
      throw new Error("This contract is iOS-only.");
    }
  };

  const runReadScenario = async () => {
    setResult("read", {
      status: "running",
      message: "Reading iOS accuracy authorization after permission grant"
    });

    try {
      ensureIOS();
      const status = await requestLocationPermission();
      if (status !== "granted") {
        throw new Error(`Permission was not granted: ${status}`);
      }

      const authorization = assertGrantedAccuracyAuthorization(
        await getAccuracyAuthorization()
      );

      setResult("read", {
        status: "passed",
        message: `Authorization: ${authorization}; permission=${status}.`
      });
    } catch (error) {
      setResult("read", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      await refreshPermission();
    }
  };

  const runTemporaryScenario = async () => {
    setResult("temporary", {
      status: "running",
      message: "Requesting temporary full accuracy with a declared purpose key"
    });

    try {
      ensureIOS();
      const status = await requestLocationPermission();
      if (status !== "granted") {
        throw new Error(`Permission was not granted: ${status}`);
      }

      const requested = assertGrantedAccuracyAuthorization(
        await requestTemporaryFullAccuracy(TEMPORARY_PURPOSE_KEY)
      );
      const current = assertGrantedAccuracyAuthorization(
        await getAccuracyAuthorization()
      );

      setResult("temporary", {
        status: "passed",
        message: `Purpose ${TEMPORARY_PURPOSE_KEY} resolved ${requested}; current authorization ${current}.`
      });
    } catch (error) {
      setResult("temporary", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    } finally {
      await refreshPermission();
    }
  };

  const runInvalidPurposeScenario = async () => {
    setResult("invalid", {
      status: "running",
      message: "Calling temporary full accuracy with an empty purpose key"
    });

    try {
      ensureIOS();
      await requestTemporaryFullAccuracy("");
      setResult("invalid", {
        status: "failed",
        message: "Empty purposeKey unexpectedly resolved."
      });
    } catch (error) {
      try {
        const locationError = assertLocationErrorCode(
          error,
          LocationErrorCode.INTERNAL_ERROR
        );
        setResult("invalid", {
          status: "passed",
          message: `${locationError.name}: empty purposeKey was rejected.`
        });
      } catch (assertionError) {
        setResult("invalid", {
          status: "failed",
          message: getDisplayErrorMessage(assertionError)
        });
      }
    }
  };

  const runDeniedReadScenario = async () => {
    setResult("denied", {
      status: "running",
      message: "Reading authorization while app location permission is denied"
    });

    try {
      ensureIOS();
      const status = await refreshPermission();
      if (status === "granted") {
        throw new Error("Permission was unexpectedly granted.");
      }

      const authorization = assertKnownAccuracyAuthorization(
        await getAccuracyAuthorization()
      );

      setResult("denied", {
        status: "passed",
        message: `Authorization: ${authorization}; permission=${status}; read API did not request permission.`
      });
    } catch (error) {
      setResult("denied", {
        status: "failed",
        message: getDisplayErrorMessage(error)
      });
    }
  };

  return (
    <ScenarioScreen
      prefix={PREFIX}
      title="iOS Accuracy Authorization"
      subtitle="Precise and reduced accuracy API contract"
    >
      <ScenarioSection index={1} title="Permission">
        <PermissionStatusBlock prefix={PREFIX} status={permissionStatus} />
      </ScenarioSection>

      <ScenarioSection index={2} title="Read Authorization" divided>
        <ScenarioButton
          title="Read Authorization"
          onPress={runReadScenario}
          testID={`${PREFIX}-run-read-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="read"
          label="Read authorization"
          result={results.read}
        />
      </ScenarioSection>

      <ScenarioSection index={3} title="Temporary Full Accuracy" divided>
        <ScenarioButton
          title="Request Temporary Full Accuracy"
          onPress={runTemporaryScenario}
          color="#047857"
          testID={`${PREFIX}-run-temporary-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="temporary"
          label="Temporary full accuracy"
          result={results.temporary}
        />
      </ScenarioSection>

      <ScenarioSection index={4} title="Invalid Purpose Key" divided>
        <ScenarioButton
          title="Run Invalid Purpose Key"
          onPress={runInvalidPurposeScenario}
          color="#D84315"
          testID={`${PREFIX}-run-invalid-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="invalid"
          label="Invalid purposeKey"
          result={results.invalid}
        />
      </ScenarioSection>

      <ScenarioSection index={5} title="Permission Denied Read" divided>
        <ScenarioButton
          title="Run Denied Authorization Read"
          onPress={runDeniedReadScenario}
          color="#7B1FA2"
          testID={`${PREFIX}-run-denied-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="denied"
          label="Denied read"
          result={results.denied}
        />
      </ScenarioSection>
    </ScenarioScreen>
  );
}
