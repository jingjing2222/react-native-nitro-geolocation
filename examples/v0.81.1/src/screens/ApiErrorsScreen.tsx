import React, { useEffect, useState } from "react";
import { Button, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  LocationErrorCode,
  checkPermission,
  getCurrentPosition,
  getLocationErrorCodeName,
  requestPermission
} from "react-native-nitro-geolocation";
import type { GeolocationResponse } from "react-native-nitro-geolocation";

type CapturedLocationError = {
  code: number;
  name: string;
  message: string;
};

const TIMEOUT_CONTRACT_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: -1,
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

const captureLocationError = (error: unknown): CapturedLocationError => {
  const maybeError = error as { code?: unknown; message?: unknown };
  const code =
    typeof maybeError.code === "number"
      ? maybeError.code
      : LocationErrorCode.INTERNAL_ERROR;
  const message =
    typeof maybeError.message === "string" ? maybeError.message : String(error);

  return {
    code,
    name: getLocationErrorCodeName(code),
    message
  };
};

export default function ApiErrorsScreen() {
  const [permissionStatus, setPermissionStatus] = useState("unknown");
  const [position, setPosition] = useState<GeolocationResponse | null>(null);
  const [error, setError] = useState<CapturedLocationError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCheckPermission = async () => {
    const status = await checkPermission();
    setPermissionStatus(status);
  };

  const handleRequestPermission = async () => {
    setIsLoading(true);
    try {
      const status = await requestPermission();
      setPermissionStatus(status);
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
      const nextPosition = await getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000
      });
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
      await getCurrentPosition(TIMEOUT_CONTRACT_OPTIONS);
    } catch (err) {
      setError(captureLocationError(err));
    } finally {
      setIsLoading(false);
      await handleCheckPermission();
    }
  };

  useEffect(() => {
    handleCheckPermission();
  }, []);

  return (
    <ScrollView style={styles.container} testID="api-errors-screen">
      <View style={styles.header}>
        <Text style={styles.title}>API Errors</Text>
        <Text style={styles.subtitle}>Modern API error contract</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Permission</Text>
        <Text style={styles.description}>
          Check the current app state, then request location access before the
          real position flow.
        </Text>
        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Permission:</Text>
          <Text style={styles.statusValue} testID="api-error-permission-status">
            {permissionStatus}
          </Text>
        </View>
        <View style={styles.buttonRow}>
          <View style={styles.button}>
            <Button
              title="Check Permission"
              onPress={handleCheckPermission}
              color="#2196F3"
            />
          </View>
          <View style={styles.button}>
            <Button
              title={isLoading ? "Requesting..." : "Request Permission"}
              onPress={handleRequestPermission}
              disabled={isLoading}
              color="#4CAF50"
            />
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Position Request</Text>
        <Text style={styles.description}>
          Fetch a current position through the native Modern API path.
        </Text>
        <View style={styles.buttonContainer}>
          <Button
            title={isLoading ? "Loading..." : "Get Position"}
            onPress={fetchCurrentPosition}
            disabled={isLoading}
            color="#607D8B"
          />
        </View>
        {position && (
          <View style={styles.positionContainer} testID="api-error-position">
            <Text style={styles.positionTitle}>Current Position</Text>
            <Text style={styles.positionText} testID="api-error-latitude">
              Latitude: {position.coords.latitude.toFixed(6)}
            </Text>
            <Text style={styles.positionText} testID="api-error-longitude">
              Longitude: {position.coords.longitude.toFixed(6)}
            </Text>
            <Text style={styles.positionText} testID="api-error-accuracy">
              Accuracy: {position.coords.accuracy.toFixed(2)}m
            </Text>
          </View>
        )}
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. Error Handling</Text>
        <Text style={styles.description}>
          Trigger a native timeout and compare it with the Modern API error code
          contract below.
        </Text>
        <View style={styles.buttonContainer}>
          <Button
            title={isLoading ? "Loading..." : "Force Timeout"}
            onPress={forceTimeoutError}
            disabled={isLoading}
            color="#D84315"
          />
        </View>
        <Text style={styles.resultStatus} testID="api-error-result-status">
          Result: {position ? "success" : error ? "error" : "idle"}
        </Text>
        {error && (
          <View style={styles.errorContainer} testID="api-error-details">
            <Text style={styles.errorText} testID="api-error-code">
              Code: {error.code}
            </Text>
            <Text style={styles.errorText} testID="api-error-name">
              Name: {error.name}
            </Text>
            <Text style={styles.errorText} testID="api-error-message">
              Message: {error.message}
            </Text>
          </View>
        )}
        <View style={styles.contractContainer} testID="api-error-code-contract">
          <Text style={styles.contractTitle}>Error Code Contract</Text>
          {ERROR_CODE_CONTRACT.map((item) => (
            <View
              key={item.name}
              style={styles.contractRow}
              testID={`api-error-contract-${item.name}`}
            >
              <Text style={styles.contractCode}>Code {item.code}</Text>
              <View style={styles.contractDetails}>
                <Text style={styles.contractName}>{item.name}</Text>
                <Text style={styles.contractMeaning}>{item.meaning}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff"
  },
  header: {
    padding: 20,
    backgroundColor: "#455A64"
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8
  },
  subtitle: {
    fontSize: 14,
    color: "#ECEFF1"
  },
  section: {
    padding: 20
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4
  },
  description: {
    fontSize: 13,
    color: "#666",
    marginBottom: 12,
    fontStyle: "italic"
  },
  statusContainer: {
    backgroundColor: "#ECEFF1",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12
  },
  statusLabel: {
    fontSize: 14,
    color: "#455A64",
    fontWeight: "600"
  },
  statusValue: {
    fontSize: 16,
    color: "#000",
    fontWeight: "700",
    marginTop: 4
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginVertical: 8
  },
  button: {
    flex: 1
  },
  buttonContainer: {
    marginVertical: 8
  },
  divider: {
    height: 1,
    backgroundColor: "#E0E0E0",
    marginHorizontal: 20
  },
  positionContainer: {
    backgroundColor: "#E8F5E9",
    padding: 12,
    borderRadius: 8,
    marginTop: 12
  },
  positionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2E7D32",
    marginBottom: 8
  },
  positionText: {
    fontSize: 14,
    color: "#1B5E20",
    marginVertical: 2
  },
  resultStatus: {
    fontSize: 16,
    color: "#000",
    fontWeight: "700",
    marginVertical: 8
  },
  errorContainer: {
    backgroundColor: "#FFEBEE",
    padding: 12,
    borderRadius: 8,
    marginTop: 8
  },
  errorText: {
    fontSize: 14,
    color: "#B71C1C",
    marginVertical: 2
  },
  contractContainer: {
    backgroundColor: "#FFF3E0",
    padding: 12,
    borderRadius: 8,
    marginTop: 12
  },
  contractTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#E65100",
    marginBottom: 8
  },
  contractRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderTopWidth: 1,
    borderTopColor: "#FFE0B2",
    paddingTop: 8,
    marginTop: 8,
    gap: 10
  },
  contractCode: {
    width: 64,
    fontSize: 13,
    color: "#E65100",
    fontWeight: "700"
  },
  contractDetails: {
    flex: 1
  },
  contractName: {
    fontSize: 13,
    color: "#3E2723",
    fontWeight: "700"
  },
  contractMeaning: {
    fontSize: 13,
    color: "#5D4037",
    marginTop: 2
  }
});
