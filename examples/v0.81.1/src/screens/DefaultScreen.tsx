import React, { useEffect, useState } from "react";
import {
  Button,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View
} from "react-native";
import {
  checkPermission,
  getCurrentPosition,
  requestPermission,
  useWatchPosition
} from "react-native-nitro-geolocation";
import type { GeolocationResponse } from "react-native-nitro-geolocation";
import { runWithNativeGeolocation } from "./scenarioUtils";

type DefaultScreenSection = "permission" | "currentPosition" | "watchPosition";

interface DefaultScreenProps {
  nativeGeolocation?: boolean;
  sections?: DefaultScreenSection[];
  subtitle?: string;
  title?: string;
}

const defaultSections: DefaultScreenSection[] = [
  "permission",
  "currentPosition",
  "watchPosition"
];

export default function DefaultScreen({
  nativeGeolocation = false,
  sections = defaultSections,
  subtitle = "Root API",
  title = "Geolocation API"
}: DefaultScreenProps) {
  // Permission state
  const [permissionStatus, setPermissionStatus] = useState<string>("unknown");
  const [isPermissionLoading, setIsPermissionLoading] = useState(false);

  // Current position state
  const [currentPosition, setCurrentPosition] =
    useState<GeolocationResponse | null>(null);
  const [isCurrentPositionLoading, setIsCurrentPositionLoading] =
    useState(false);
  const [currentPositionError, setCurrentPositionError] = useState<
    string | null
  >(null);

  // Watch position hook (continuous)
  const [watchEnabled, setWatchEnabled] = useState(false);
  useEffect(() => {
    if (!nativeGeolocation) return;

    const previousDevtoolsEnabled = globalThis.__geolocationDevToolsEnabled;
    globalThis.__geolocationDevToolsEnabled = false;

    return () => {
      globalThis.__geolocationDevToolsEnabled = previousDevtoolsEnabled;
    };
  }, [nativeGeolocation]);

  const {
    position: watchedPosition,
    error: watchError,
    isWatching
  } = useWatchPosition({
    enabled: watchEnabled,
    enableHighAccuracy: true,
    distanceFilter: 10,
    interval: 5000
  });

  const handleCheckPermission = async () => {
    try {
      const status = await checkPermission();
      setPermissionStatus(status);
    } catch (err) {
      setPermissionStatus("error");
    }
  };

  const handleRequestPermission = async () => {
    setIsPermissionLoading(true);
    try {
      const status = await requestPermission();
      setPermissionStatus(status);
    } catch (err) {
      console.error("Permission request failed:", err);
      setPermissionStatus("error");
    } finally {
      setIsPermissionLoading(false);
    }
  };

  const handleFetchPosition = async () => {
    setIsCurrentPositionLoading(true);
    setCurrentPosition(null);
    setCurrentPositionError(null);
    try {
      const position = await (nativeGeolocation
        ? runWithNativeGeolocation(() =>
            getCurrentPosition({
              enableHighAccuracy: true,
              timeout: 15000
            })
          )
        : getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 15000
          }));
      setCurrentPosition(position);
    } catch (err: any) {
      setCurrentPositionError(err?.message || "Unknown error");
    } finally {
      setIsCurrentPositionLoading(false);
    }
  };

  const renderPermissionSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>1. Permission Management</Text>
      <Text style={styles.description}>
        Check and request location permissions
      </Text>
      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Status:</Text>
        <Text style={styles.statusValue}>
          {permissionStatus}
          {permissionStatus === "granted" && " ✅"}
          {permissionStatus === "denied" && " ❌"}
        </Text>
      </View>
      <View style={styles.buttonRow}>
        <View style={styles.button}>
          <Button
            title="Check"
            onPress={handleCheckPermission}
            color="#2196F3"
          />
        </View>
        <View style={styles.button}>
          <Button
            title={isPermissionLoading ? "Requesting..." : "Request"}
            onPress={handleRequestPermission}
            disabled={isPermissionLoading}
            color="#4CAF50"
          />
        </View>
      </View>
    </View>
  );

  const renderPositionInfo = (
    position: GeolocationResponse | null,
    title: string
  ) => {
    if (!position) return null;

    return (
      <View style={styles.positionContainer} testID="position-info">
        <Text style={styles.positionTitle}>{title}</Text>
        <Text style={styles.positionText} testID="latitude-text">
          Latitude: {position.coords.latitude.toFixed(6)}
        </Text>
        <Text style={styles.positionText} testID="longitude-text">
          Longitude: {position.coords.longitude.toFixed(6)}
        </Text>
        <Text style={styles.positionText} testID="accuracy-text">
          Accuracy: {position.coords.accuracy.toFixed(2)}m
        </Text>
        {position.mocked !== undefined && (
          <Text style={styles.positionText} testID="mocked-text">
            Mocked: {position.mocked ? "true" : "false"}
          </Text>
        )}
        {position.provider !== undefined && (
          <Text style={styles.positionText} testID="provider-text">
            Provider: {position.provider}
          </Text>
        )}
        {position.coords.altitude !== null && (
          <Text style={styles.positionText}>
            Altitude: {position.coords.altitude.toFixed(2)}m
          </Text>
        )}
        {position.coords.speed !== null && (
          <Text style={styles.positionText}>
            Speed: {position.coords.speed.toFixed(2)}m/s
          </Text>
        )}
        {position.coords.heading !== null && (
          <Text style={styles.positionText}>
            Heading: {position.coords.heading.toFixed(2)}°
          </Text>
        )}
        <Text style={styles.positionText}>
          Time: {new Date(position.timestamp).toLocaleString()}
        </Text>
      </View>
    );
  };

  const renderCurrentPositionSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>2. Get Current Position</Text>
      <Text style={styles.description}>
        One-time location request using getCurrentPosition()
      </Text>
      {currentPositionError && (
        <View style={styles.errorContainer} testID="current-position-error">
          <Text style={styles.errorText} testID="current-position-error-text">
            Error: {currentPositionError}
          </Text>
        </View>
      )}
      <View style={styles.buttonContainer}>
        <Button
          title={isCurrentPositionLoading ? "Loading..." : "Get Position"}
          onPress={handleFetchPosition}
          disabled={isCurrentPositionLoading}
          color="#4CAF50"
        />
      </View>
      {renderPositionInfo(currentPosition, "Current Position")}
    </View>
  );

  const renderWatchPositionSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>3. Watch Position (Hook)</Text>
      <Text style={styles.description}>
        Continuous location tracking with useWatchPosition()
      </Text>
      <View style={styles.toggleContainer}>
        <Text style={styles.toggleLabel}>Enable Watching:</Text>
        <Switch
          testID="watch-toggle-switch"
          value={watchEnabled}
          onValueChange={setWatchEnabled}
        />
      </View>
      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Status:</Text>
        <Text style={styles.statusValue} testID="watch-status">
          {isWatching ? "Watching 🟢" : "Not Watching 🔴"}
        </Text>
      </View>
      {watchError && (
        <View style={styles.errorContainer} testID="watch-position-error">
          <Text style={styles.errorText} testID="watch-position-error-text">
            Error: {watchError.message}
          </Text>
        </View>
      )}
      {renderPositionInfo(watchedPosition, "Watched Position (Live)")}
    </View>
  );

  const renderSection = (section: DefaultScreenSection) => {
    switch (section) {
      case "permission":
        return renderPermissionSection();
      case "currentPosition":
        return renderCurrentPositionSection();
      case "watchPosition":
        return renderWatchPositionSection();
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      {sections.map((section, index) => (
        <React.Fragment key={section}>
          {index > 0 && <View style={styles.divider} />}
          {renderSection(section)}
        </React.Fragment>
      ))}
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
    backgroundColor: "#2196F3"
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8
  },
  subtitle: {
    fontSize: 14,
    color: "#E3F2FD"
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
    backgroundColor: "#E3F2FD",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12
  },
  statusLabel: {
    fontSize: 14,
    color: "#1976D2",
    fontWeight: "600"
  },
  statusValue: {
    fontSize: 16,
    color: "#000",
    fontWeight: "700",
    marginTop: 4
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
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F5F5F5",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12
  },
  toggleLabel: {
    fontSize: 16,
    color: "#000",
    fontWeight: "600"
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
