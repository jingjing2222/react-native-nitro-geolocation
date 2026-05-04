import React, { useEffect, useState } from "react";
import { Button, Platform, ScrollView, Text, View } from "react-native";
import {
  LocationErrorCode,
  checkPermission,
  getAccuracyAuthorization,
  requestPermission,
  requestTemporaryFullAccuracy
} from "react-native-nitro-geolocation";
import {
  ResultBlock,
  assertGrantedAccuracyAuthorization,
  assertKnownAccuracyAuthorization,
  assertLocationErrorCode,
  createIdleResult,
  getDisplayErrorMessage,
  sharedStyles
} from "./scenarioUtils";
import type { ScenarioResult } from "./scenarioUtils";

const PREFIX = "ios-accuracy-authorization";
const TEMPORARY_PURPOSE_KEY = "PreciseE2E";

const initialResults = {
  read: createIdleResult(),
  temporary: createIdleResult(),
  invalid: createIdleResult(),
  denied: createIdleResult()
};

export default function IOSAccuracyAuthorizationScreen() {
  const [permissionStatus, setPermissionStatus] = useState("unknown");
  const [results, setResults] = useState(initialResults);

  const setResult = (
    key: keyof typeof initialResults,
    result: ScenarioResult
  ) => {
    setResults((previous) => ({
      ...previous,
      [key]: result
    }));
  };

  const refreshPermission = async () => {
    const status = await checkPermission();
    setPermissionStatus(status);
    return status;
  };

  const requestLocationPermission = async () => {
    const status = await requestPermission();
    setPermissionStatus(status);
    return status;
  };

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

  useEffect(() => {
    refreshPermission();
  }, []);

  return (
    <ScrollView style={sharedStyles.container} testID={`${PREFIX}-screen`}>
      <View style={sharedStyles.header}>
        <Text style={sharedStyles.title}>iOS Accuracy Authorization</Text>
        <Text style={sharedStyles.subtitle}>
          Precise and reduced accuracy API contract
        </Text>
      </View>

      <View style={sharedStyles.section}>
        <Text style={sharedStyles.sectionTitle}>1. Permission</Text>
        <View style={sharedStyles.statusContainer}>
          <Text style={sharedStyles.statusLabel}>Permission:</Text>
          <Text
            style={sharedStyles.statusValue}
            testID={`${PREFIX}-permission`}
          >
            {permissionStatus}
          </Text>
        </View>
      </View>

      <View style={sharedStyles.divider} />

      <View style={sharedStyles.section}>
        <Text style={sharedStyles.sectionTitle}>2. Read Authorization</Text>
        <View style={sharedStyles.buttonContainer}>
          <Button
            title="Read Authorization"
            onPress={runReadScenario}
            color="#1976D2"
            testID={`${PREFIX}-run-read-button`}
          />
        </View>
        <ResultBlock
          prefix={PREFIX}
          id="read"
          label="Read authorization"
          result={results.read}
        />
      </View>

      <View style={sharedStyles.divider} />

      <View style={sharedStyles.section}>
        <Text style={sharedStyles.sectionTitle}>
          3. Temporary Full Accuracy
        </Text>
        <View style={sharedStyles.buttonContainer}>
          <Button
            title="Request Temporary Full Accuracy"
            onPress={runTemporaryScenario}
            color="#047857"
            testID={`${PREFIX}-run-temporary-button`}
          />
        </View>
        <ResultBlock
          prefix={PREFIX}
          id="temporary"
          label="Temporary full accuracy"
          result={results.temporary}
        />
      </View>

      <View style={sharedStyles.divider} />

      <View style={sharedStyles.section}>
        <Text style={sharedStyles.sectionTitle}>4. Invalid Purpose Key</Text>
        <View style={sharedStyles.buttonContainer}>
          <Button
            title="Run Invalid Purpose Key"
            onPress={runInvalidPurposeScenario}
            color="#D84315"
            testID={`${PREFIX}-run-invalid-button`}
          />
        </View>
        <ResultBlock
          prefix={PREFIX}
          id="invalid"
          label="Invalid purposeKey"
          result={results.invalid}
        />
      </View>

      <View style={sharedStyles.divider} />

      <View style={sharedStyles.section}>
        <Text style={sharedStyles.sectionTitle}>5. Permission Denied Read</Text>
        <View style={sharedStyles.buttonContainer}>
          <Button
            title="Run Denied Authorization Read"
            onPress={runDeniedReadScenario}
            color="#7B1FA2"
            testID={`${PREFIX}-run-denied-button`}
          />
        </View>
        <ResultBlock
          prefix={PREFIX}
          id="denied"
          label="Denied read"
          result={results.denied}
        />
      </View>
    </ScrollView>
  );
}
