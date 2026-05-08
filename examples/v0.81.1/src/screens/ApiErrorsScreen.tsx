import React, { useState } from "react";
import { Text, View } from "react-native";
import {
  LocationErrorCode,
  getCurrentPosition,
  getLocationErrorCodeName
} from "react-native-nitro-geolocation";
import type { GeolocationResponse } from "react-native-nitro-geolocation";
import {
  ButtonRow,
  KeyValueBlock,
  PositionInfo,
  ScenarioButton,
  ScenarioScreen,
  ScenarioSection,
  StatusBlock,
  captureLocationError,
  runWithNativeGeolocation,
  sharedStyles,
  usePermissionStatus
} from "./scenario";
import type { CapturedLocationError } from "./scenario";

const TIMEOUT_CONTRACT_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 0
};

const ERROR_CODE_CONTRACT = [
  {
    code: LocationErrorCode.INTERNAL_ERROR,
    name: getLocationErrorCodeName(LocationErrorCode.INTERNAL_ERROR),
    meaning: "Modern-only internal/native failure"
  },
  {
    code: LocationErrorCode.PERMISSION_DENIED,
    name: getLocationErrorCodeName(LocationErrorCode.PERMISSION_DENIED),
    meaning: "Permission was denied"
  },
  {
    code: LocationErrorCode.POSITION_UNAVAILABLE,
    name: getLocationErrorCodeName(LocationErrorCode.POSITION_UNAVAILABLE),
    meaning: "Position fix is unavailable"
  },
  {
    code: LocationErrorCode.TIMEOUT,
    name: getLocationErrorCodeName(LocationErrorCode.TIMEOUT),
    meaning: "Request timed out"
  },
  {
    code: LocationErrorCode.PLAY_SERVICE_NOT_AVAILABLE,
    name: getLocationErrorCodeName(
      LocationErrorCode.PLAY_SERVICE_NOT_AVAILABLE
    ),
    meaning: "Modern-only Google Play Services failure"
  },
  {
    code: LocationErrorCode.SETTINGS_NOT_SATISFIED,
    name: getLocationErrorCodeName(LocationErrorCode.SETTINGS_NOT_SATISFIED),
    meaning: "Modern-only provider/settings failure"
  }
] as const;

export default function ApiErrorsScreen() {
  const { permissionStatus, refreshPermission, requestLocationPermission } =
    usePermissionStatus();
  const [position, setPosition] = useState<GeolocationResponse | null>(null);
  const [error, setError] = useState<CapturedLocationError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCheckPermission = async () => {
    await refreshPermission();
  };

  const handleRequestPermission = async () => {
    setIsLoading(true);
    try {
      await requestLocationPermission();
    } catch (err) {
      setError(captureLocationError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCurrentPosition = async () => {
    setIsLoading(true);
    setPosition(null);
    setError(null);

    try {
      const nextPosition = await runWithNativeGeolocation(() =>
        getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000
        })
      );
      setPosition(nextPosition);
    } catch (err) {
      setError(captureLocationError(err));
    } finally {
      setIsLoading(false);
      await handleCheckPermission();
    }
  };

  const forceTimeoutError = async () => {
    setIsLoading(true);
    setPosition(null);
    setError(null);

    try {
      await runWithNativeGeolocation(() =>
        getCurrentPosition(TIMEOUT_CONTRACT_OPTIONS)
      );
    } catch (err) {
      setError(captureLocationError(err));
    } finally {
      setIsLoading(false);
      await handleCheckPermission();
    }
  };

  return (
    <ScenarioScreen
      prefix="api-errors"
      title="API Errors"
      subtitle="Modern API error contract"
    >
      <ScenarioSection
        index={1}
        title="Permission"
        description="Check the current app state, then request location access before the real position flow."
      >
        <StatusBlock
          rows={[
            {
              label: "Permission:",
              value: permissionStatus,
              testID: "api-error-permission-status"
            }
          ]}
        />
        <ButtonRow>
          <ScenarioButton
            title="Check Permission"
            onPress={handleCheckPermission}
            color="#2196F3"
            containerStyle={sharedStyles.button}
          />
          <ScenarioButton
            title={isLoading ? "Requesting..." : "Request Permission"}
            onPress={handleRequestPermission}
            disabled={isLoading}
            color="#4CAF50"
            containerStyle={sharedStyles.button}
          />
        </ButtonRow>
      </ScenarioSection>

      <ScenarioSection
        index={2}
        title="Position Request"
        description="Fetch a current position through the native Modern API path."
        divided
      >
        <ScenarioButton
          title={isLoading ? "Loading..." : "Get Position"}
          onPress={fetchCurrentPosition}
          disabled={isLoading}
          color="#607D8B"
        />
        <PositionInfo
          title="Current Position"
          position={position}
          includeOptionalFields={false}
          testIDs={{
            container: "api-error-position",
            latitude: "api-error-latitude",
            longitude: "api-error-longitude",
            accuracy: "api-error-accuracy"
          }}
        />
      </ScenarioSection>

      <ScenarioSection
        index={3}
        title="Error Handling"
        description="Trigger a native timeout and compare it with the Modern API error code contract below."
        divided
      >
        <ScenarioButton
          title={isLoading ? "Loading..." : "Force Timeout"}
          onPress={forceTimeoutError}
          disabled={isLoading}
          color="#D84315"
        />
        <Text
          style={sharedStyles.resultStatus}
          testID="api-error-result-status"
        >
          Result: {position ? "success" : error ? "error" : "idle"}
        </Text>
        {error && (
          <KeyValueBlock
            testID="api-error-details"
            rows={[
              { label: "Code", value: error.code, testID: "api-error-code" },
              { label: "Name", value: error.name, testID: "api-error-name" },
              {
                label: "Message",
                value: error.message,
                testID: "api-error-message"
              }
            ]}
          />
        )}
        <View
          style={sharedStyles.scenarioContainer}
          testID="api-error-code-contract"
        >
          <Text style={sharedStyles.scenarioTitle}>Error Code Contract</Text>
          {ERROR_CODE_CONTRACT.map((item) => (
            <View
              key={item.name}
              style={sharedStyles.statusStackRow}
              testID={`api-error-contract-${item.name}`}
            >
              <Text style={sharedStyles.scenarioTitle}>Code {item.code}</Text>
              <Text style={sharedStyles.scenarioText}>{item.name}</Text>
              <Text style={sharedStyles.resultMessage}>{item.meaning}</Text>
            </View>
          ))}
        </View>
      </ScenarioSection>
    </ScenarioScreen>
  );
}
