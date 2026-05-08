import React, { useEffect, useState } from "react";
import { PermissionsAndroid, Platform, Text } from "react-native";
import { getCurrentPosition } from "react-native-nitro-geolocation";
import type { GeolocationResponse } from "react-native-nitro-geolocation";
import {
  ButtonRow,
  ErrorBlock,
  PositionInfo,
  ScenarioButton,
  ScenarioScreen,
  ScenarioSection,
  StatusBlock,
  sharedStyles
} from "./scenario";

type AndroidPermissionState = {
  fine: "granted" | "denied";
  coarse: "granted" | "denied";
};

const LOW_ACCURACY_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 12000,
  maximumAge: 120000
};

const APPROXIMATE_PROVIDER_UNAVAILABLE_MESSAGE =
  "No location provider is available for approximate location. ACCESS_COARSE_LOCATION is granted, but no enabled coarse-compatible provider is available.";

const getDisplayErrorMessage = (err: any) => {
  const message = err?.message || String(err);
  if (message.includes(APPROXIMATE_PROVIDER_UNAVAILABLE_MESSAGE)) {
    return APPROXIMATE_PROVIDER_UNAVAILABLE_MESSAGE;
  }
  if (message.includes("No location provider")) {
    return message.split("\n")[0] || "No location provider available";
  }
  if (message.includes("Unable to fetch location within")) {
    return "Unable to fetch location within timeout";
  }
  return message.split("\n")[0] || "Unknown error";
};

export default function Issue67Screen() {
  const [permissionState, setPermissionState] =
    useState<AndroidPermissionState>({
      fine: "denied",
      coarse: "denied"
    });
  const [position, setPosition] = useState<GeolocationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refreshPermissions = async () => {
    if (Platform.OS !== "android") {
      return;
    }

    const [fineGranted, coarseGranted] = await Promise.all([
      PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      ),
      PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
      )
    ]);

    setPermissionState({
      fine: fineGranted ? "granted" : "denied",
      coarse: coarseGranted ? "granted" : "denied"
    });
  };

  const requestAndroidLocationPermissions = async () => {
    if (Platform.OS !== "android") {
      return;
    }

    await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
    ]);
    await refreshPermissions();
  };

  const fetchApproximatePosition = async () => {
    setIsLoading(true);
    setPosition(null);
    setError(null);

    try {
      const nextPosition = await getCurrentPosition(LOW_ACCURACY_OPTIONS);
      setPosition(nextPosition);
    } catch (err: any) {
      setError(getDisplayErrorMessage(err));
    } finally {
      setIsLoading(false);
      await refreshPermissions();
    }
  };

  useEffect(() => {
    refreshPermissions();
  }, []);

  return (
    <ScenarioScreen
      prefix="issue67"
      title="Issue 67"
      subtitle="Android approximate/coarse getCurrentPosition contract"
    >
      <ScenarioSection
        index={1}
        title="Permission State"
        description="Contract setup: ACCESS_COARSE_LOCATION granted and ACCESS_FINE_LOCATION denied."
      >
        <StatusBlock
          testID="issue67-permission-summary"
          rows={[
            {
              label: "Fine:",
              value: permissionState.fine
            },
            {
              label: "Coarse:",
              value: permissionState.coarse
            }
          ]}
        />
        <ButtonRow>
          <ScenarioButton
            title="Refresh"
            onPress={refreshPermissions}
            color="#2196F3"
            testID="issue67-refresh-permissions-button"
            containerStyle={sharedStyles.button}
          />
          <ScenarioButton
            title="Request"
            onPress={requestAndroidLocationPermissions}
            color="#4CAF50"
            testID="issue67-request-permissions-button"
            containerStyle={sharedStyles.button}
          />
        </ButtonRow>
      </ScenarioSection>

      <ScenarioSection
        index={2}
        title="Low Accuracy Request"
        description="Calls getCurrentPosition with enableHighAccuracy=false, timeout=12000, maximumAge=120000."
        divided
      >
        <ScenarioButton
          title={isLoading ? "Loading..." : "Get Approximate Position"}
          onPress={fetchApproximatePosition}
          disabled={isLoading}
          color="#607D8B"
          testID="issue67-get-position-button"
        />
        <Text style={sharedStyles.resultStatus} testID="issue67-result-status">
          Result: {position ? "success" : error ? "error" : "idle"}
        </Text>
        {error && <ErrorBlock message={error} testID="issue67-error" />}
        <PositionInfo
          title="Approximate Current Position"
          position={position}
          includeOptionalFields={false}
          testIDs={{
            container: "issue67-position-info",
            latitude: "issue67-latitude",
            longitude: "issue67-longitude",
            accuracy: "issue67-accuracy"
          }}
        />
      </ScenarioSection>
    </ScenarioScreen>
  );
}
