import React, { useEffect, useState } from "react";
import {
  Button,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { getCurrentPosition } from "react-native-nitro-geolocation";
import type { GeolocationResponse } from "react-native-nitro-geolocation";

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
    <ScrollView style={styles.container} testID="issue67-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Issue 67</Text>
        <Text style={styles.subtitle}>
          Android approximate/coarse getCurrentPosition contract
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Permission State</Text>
        <Text style={styles.description}>
          Contract setup: ACCESS_COARSE_LOCATION granted and
          ACCESS_FINE_LOCATION denied.
        </Text>
        <View
          style={styles.statusContainer}
          testID="issue67-permission-summary"
        >
          <Text style={styles.statusLabel}>Fine:</Text>
          <Text style={styles.statusValue}>{permissionState.fine}</Text>
          <Text style={styles.statusLabel}>Coarse:</Text>
          <Text style={styles.statusValue}>{permissionState.coarse}</Text>
        </View>
        <View style={styles.buttonRow}>
          <View style={styles.button}>
            <Button
              title="Refresh"
              onPress={refreshPermissions}
              color="#2196F3"
              testID="issue67-refresh-permissions-button"
            />
          </View>
          <View style={styles.button}>
            <Button
              title="Request"
              onPress={requestAndroidLocationPermissions}
              color="#4CAF50"
              testID="issue67-request-permissions-button"
            />
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Low Accuracy Request</Text>
        <Text style={styles.description}>
          Calls getCurrentPosition with enableHighAccuracy=false, timeout=12000,
          maximumAge=120000.
        </Text>
        <View style={styles.buttonContainer}>
          <Button
            title={isLoading ? "Loading..." : "Get Approximate Position"}
            onPress={fetchApproximatePosition}
            disabled={isLoading}
            color="#607D8B"
            testID="issue67-get-position-button"
          />
        </View>
        <Text style={styles.resultStatus} testID="issue67-result-status">
          Result: {position ? "success" : error ? "error" : "idle"}
        </Text>
        {error && (
          <View style={styles.errorContainer} testID="issue67-error">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        {position && (
          <View style={styles.positionContainer} testID="issue67-position-info">
            <Text style={styles.positionTitle}>
              Approximate Current Position
            </Text>
            <Text style={styles.positionText} testID="issue67-latitude">
              Latitude: {position.coords.latitude.toFixed(6)}
            </Text>
            <Text style={styles.positionText} testID="issue67-longitude">
              Longitude: {position.coords.longitude.toFixed(6)}
            </Text>
            <Text style={styles.positionText} testID="issue67-accuracy">
              Accuracy: {position.coords.accuracy.toFixed(2)}m
            </Text>
          </View>
        )}
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
    backgroundColor: "#607D8B"
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
    marginBottom: 8,
    marginTop: 2
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
    marginBottom: 12
  },
  errorText: {
    fontSize: 14,
    color: "#C62828"
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
  positionContainer: {
    marginTop: 12,
    padding: 16,
    backgroundColor: "#E8F5E9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4CAF50"
  },
  positionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2E7D32",
    marginBottom: 8
  },
  positionText: {
    fontSize: 14,
    color: "#1B5E20",
    marginVertical: 2
  },
  divider: {
    height: 1,
    backgroundColor: "#E0E0E0"
  }
});
