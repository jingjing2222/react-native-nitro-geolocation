import React, { useEffect, useState } from "react";
import { Button, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  LocationErrorCode,
  checkPermission,
  getCurrentPosition,
  getLocationErrorCodeName,
  getProviderStatus,
  hasServicesEnabled,
  requestLocationSettings,
  requestPermission
} from "react-native-nitro-geolocation";
import type {
  GeolocationResponse,
  LocationProviderStatus
} from "react-native-nitro-geolocation";

type CapturedLocationError = {
  code: number;
  name: string;
  message: string;
};

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

const formatBoolean = (value: boolean | null | undefined) => {
  if (value === undefined || value === null) return "unknown";
  return value ? "enabled" : "disabled";
};

export default function ProviderSettingsScreen() {
  const [permissionStatus, setPermissionStatus] = useState("unknown");
  const [servicesEnabled, setServicesEnabled] = useState<boolean | null>(null);
  const [providerStatus, setProviderStatus] =
    useState<LocationProviderStatus | null>(null);
  const [settingsStatus, setSettingsStatus] = useState("not requested");
  const [position, setPosition] = useState<GeolocationResponse | null>(null);
  const [error, setError] = useState<CapturedLocationError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const providerReady =
    servicesEnabled === true &&
    providerStatus?.locationServicesEnabled === true &&
    providerStatus.gpsAvailable === true &&
    providerStatus.networkAvailable === true;

  const refreshReadiness = async () => {
    const [permission, enabled, status] = await Promise.all([
      checkPermission(),
      hasServicesEnabled(),
      getProviderStatus()
    ]);

    setPermissionStatus(permission);
    setServicesEnabled(enabled);
    setProviderStatus(status);
  };

  const checkDevice = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await refreshReadiness();
    } catch (err) {
      setError(captureLocationError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const prepareCheckIn = async () => {
    setIsLoading(true);
    setError(null);
    setSettingsStatus("checking");

    try {
      const permission = await requestPermission();
      setPermissionStatus(permission);

      if (permission !== "granted") {
        setSettingsStatus("permission required");
        setError({
          code: LocationErrorCode.PERMISSION_DENIED,
          name: getLocationErrorCodeName(LocationErrorCode.PERMISSION_DENIED),
          message: "Location permission is required before check-in."
        });
        return;
      }

      const status = await requestLocationSettings({
        enableHighAccuracy: true,
        interval: 5000,
        fastestInterval: 1000,
        alwaysShow: true
      });

      setProviderStatus(status);
      setServicesEnabled(status.locationServicesEnabled);
      setSettingsStatus("ready");
    } catch (err) {
      setSettingsStatus("blocked");
      setError(captureLocationError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const confirmLocation = async () => {
    setIsLoading(true);
    setError(null);
    setPosition(null);

    try {
      const currentPosition = await getCurrentPosition({
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000
      });
      setPosition(currentPosition);
      await refreshReadiness();
    } catch (err) {
      setError(captureLocationError(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkDevice();
  }, []);

  return (
    <ScrollView style={styles.container} testID="provider-settings-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Accurate Check-In</Text>
        <Text style={styles.subtitle}>Android provider readiness contract</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Device Readiness</Text>
        <Text style={styles.description}>
          Confirm the device can provide the precise location needed before a
          field check-in.
        </Text>
        <View style={styles.statusPanel} testID="provider-settings-status">
          <StatusRow label="Permission" value={permissionStatus} />
          <StatusRow
            label="Services"
            testID="provider-settings-services"
            value={formatBoolean(servicesEnabled)}
          />
          <StatusRow
            label="GPS"
            testID="provider-settings-gps"
            value={formatBoolean(providerStatus?.gpsAvailable)}
          />
          <StatusRow
            label="Network"
            testID="provider-settings-network"
            value={formatBoolean(providerStatus?.networkAvailable)}
          />
          <StatusRow
            label="Google Accuracy"
            testID="provider-settings-google-accuracy"
            value={formatBoolean(providerStatus?.googleLocationAccuracyEnabled)}
          />
          <Text
            style={styles.providerContract}
            testID="provider-readiness-contract"
          >
            Provider readiness: {providerReady ? "ready" : "not ready"}
          </Text>
        </View>
        <View style={styles.buttonContainer}>
          <Button
            title={isLoading ? "Checking..." : "Check Device"}
            onPress={checkDevice}
            disabled={isLoading}
            color="#1565C0"
          />
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Prepare Check-In</Text>
        <Text style={styles.description}>
          Ask Android to enable the settings required for a high-accuracy
          check-in location.
        </Text>
        <Text style={styles.statusValue} testID="provider-settings-result">
          Settings: {settingsStatus}
        </Text>
        <View style={styles.buttonContainer}>
          <Button
            title={isLoading ? "Preparing..." : "Prepare Check-In"}
            onPress={prepareCheckIn}
            disabled={isLoading}
            color="#2E7D32"
          />
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. Confirm Location</Text>
        <Text style={styles.description}>
          Capture the current precise position only after the device is ready.
        </Text>
        <View style={styles.buttonContainer}>
          <Button
            title={isLoading ? "Locating..." : "Confirm Location"}
            onPress={confirmLocation}
            disabled={isLoading}
            color="#455A64"
          />
        </View>
        {position && (
          <View style={styles.positionContainer} testID="provider-position">
            <Text style={styles.positionTitle} testID="provider-check-in-ready">
              Ready to check in
            </Text>
            <Text style={styles.positionText} testID="provider-latitude">
              Latitude: {position.coords.latitude.toFixed(6)}
            </Text>
            <Text style={styles.positionText} testID="provider-longitude">
              Longitude: {position.coords.longitude.toFixed(6)}
            </Text>
            <Text style={styles.positionText} testID="provider-accuracy">
              Accuracy: {position.coords.accuracy.toFixed(2)}m
            </Text>
            {position.provider && (
              <Text style={styles.positionText} testID="provider-used">
                Provider: {position.provider}
              </Text>
            )}
          </View>
        )}
      </View>

      {error && (
        <View style={styles.errorContainer} testID="provider-settings-error">
          <Text style={styles.errorText}>Code: {error.code}</Text>
          <Text style={styles.errorText}>Name: {error.name}</Text>
          <Text style={styles.errorText}>Message: {error.message}</Text>
        </View>
      )}
    </ScrollView>
  );
}

function StatusRow({
  label,
  testID,
  value
}: {
  label: string;
  testID?: string;
  value: string;
}) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusRowText} testID={testID}>
        <Text style={styles.statusRowLabel}>{label}: </Text>
        <Text style={styles.statusRowValue}>{value}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff"
  },
  header: {
    padding: 20,
    backgroundColor: "#1E3A5F"
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8
  },
  subtitle: {
    fontSize: 14,
    color: "#DDE7F0"
  },
  section: {
    padding: 20
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8
  },
  description: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
    lineHeight: 20
  },
  divider: {
    height: 1,
    backgroundColor: "#E0E0E0"
  },
  statusPanel: {
    backgroundColor: "#F5F7FA",
    borderRadius: 8,
    padding: 14,
    marginBottom: 16
  },
  statusRow: {
    marginBottom: 8
  },
  statusRowText: {
    fontSize: 14
  },
  statusRowLabel: {
    fontSize: 14,
    color: "#4A5568",
    fontWeight: "600"
  },
  statusRowValue: {
    fontSize: 14,
    color: "#1A202C"
  },
  providerContract: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "600",
    color: "#1A202C"
  },
  statusValue: {
    fontSize: 16,
    color: "#1565C0",
    marginBottom: 16
  },
  buttonContainer: {
    marginVertical: 4
  },
  positionContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: "#E8F5E9",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#2E7D32"
  },
  positionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1B5E20",
    marginBottom: 8
  },
  positionText: {
    fontSize: 14,
    color: "#2E7D32",
    marginVertical: 2
  },
  errorContainer: {
    margin: 20,
    marginTop: 0,
    padding: 12,
    backgroundColor: "#FFEBEE",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#F44336"
  },
  errorText: {
    color: "#C62828",
    fontSize: 14,
    marginVertical: 2
  }
});
