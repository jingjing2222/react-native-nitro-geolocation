import React, { useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import {
  checkPermission,
  getCurrentPosition,
  requestPermission
} from "react-native-nitro-geolocation";
import type {
  GeolocationResponse,
  PermissionStatus
} from "react-native-nitro-geolocation";

type ContractStatus =
  | "idle"
  | "running"
  | "ready"
  | "passed"
  | "permission-required"
  | "failed";

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return String(error);
}

function Button({
  disabled = false,
  onPress,
  testID,
  title
}: {
  disabled?: boolean;
  onPress: () => void;
  testID: string;
  title: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && styles.buttonDisabled]}
      testID={testID}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}

export default function ConsumerLocationContractScreen() {
  const [status, setStatus] = useState<ContractStatus>("idle");
  const [permission, setPermission] =
    useState<PermissionStatus>("undetermined");
  const [position, setPosition] = useState<GeolocationResponse>();
  const [error, setError] = useState<string>();

  const useLocation = async () => {
    setStatus("running");
    setPosition(undefined);
    setError(undefined);

    try {
      const currentPermission = await checkPermission();
      setPermission(currentPermission);
      if (currentPermission !== "granted") {
        setStatus("permission-required");
        return;
      }

      const currentPosition = await getCurrentPosition({
        accuracy: { android: "high", ios: "best" },
        maximumAge: 0,
        timeout: 30_000
      });
      const { latitude, longitude } = currentPosition.coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error("Location returned invalid coordinates.");
      }

      setPosition(currentPosition);
      setStatus("passed");
    } catch (locationError) {
      setError(errorMessage(locationError));
      setStatus("failed");
    }
  };

  const askForPermission = async () => {
    setStatus("running");
    setError(undefined);

    try {
      const nextPermission = await requestPermission();
      setPermission(nextPermission);
      setStatus(nextPermission === "granted" ? "ready" : "permission-required");
    } catch (permissionError) {
      setError(errorMessage(permissionError));
      setStatus("failed");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} testID="consumer-location-screen">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Use your location</Text>
        <Text style={styles.description}>
          Check permission before requesting a fresh position, and keep denied
          permission visible so the user can choose the next action.
        </Text>

        <View style={styles.card}>
          <Text testID="consumer-location-status">Status: {status}</Text>
          <Text testID="consumer-location-permission">
            Permission: {permission}
          </Text>
          {position ? (
            <Text testID="consumer-location-position">
              Coordinates: {position.coords.latitude.toFixed(6)},{" "}
              {position.coords.longitude.toFixed(6)}
            </Text>
          ) : null}
          {error ? (
            <Text style={styles.error} testID="consumer-location-error">
              Error: {error}
            </Text>
          ) : null}
        </View>

        <Button
          disabled={status === "running"}
          onPress={useLocation}
          testID="consumer-location-run"
          title={status === "running" ? "Locating…" : "Use my location"}
        />
        {status === "permission-required" ? (
          <Button
            onPress={askForPermission}
            testID="consumer-location-request-permission"
            title="Request location permission"
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f4f7fb"
  },
  content: {
    gap: 16,
    padding: 24
  },
  title: {
    color: "#14213d",
    fontSize: 28,
    fontWeight: "700"
  },
  description: {
    color: "#40516f",
    fontSize: 16,
    lineHeight: 24
  },
  card: {
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#ffffff"
  },
  button: {
    alignItems: "center",
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#1769e0"
  },
  buttonDisabled: {
    opacity: 0.55
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600"
  },
  error: {
    color: "#b42318"
  }
});
