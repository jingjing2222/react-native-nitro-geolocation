import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View
} from "react-native";
import {
  type GeolocationPosition,
  clearWatch,
  getCurrentPosition,
  requestAuthorization,
  setRNConfiguration,
  watchPosition
} from "react-native-nitro-geolocation";

export default function App() {
  const [permissionStatus, setPermissionStatus] = useState<string>("Unknown");
  const [currentPosition, setCurrentPosition] =
    useState<GeolocationPosition | null>(null);
  const [isLoadingPosition, setIsLoadingPosition] = useState(false);

  const [watchId, setWatchId] = useState<number | null>(null);
  const [watchedPosition, setWatchedPosition] =
    useState<GeolocationPosition | null>(null);
  const [watchUpdateCount, setWatchUpdateCount] = useState(0);

  useEffect(() => {
    // Configure geolocation
    setRNConfiguration({
      skipPermissionRequests: false,
      authorizationLevel: "whenInUse",
      locationProvider: "auto"
    });
  }, []);

  const handleRequestAuthorization = () => {
    setPermissionStatus("Requesting...");
    requestAuthorization(
      () => {
        setPermissionStatus("Granted ✅");
        Alert.alert("Success", "Location permission granted!");
      },
      (error) => {
        setPermissionStatus(`Denied ❌ (Code: ${error.code})`);
        Alert.alert("Error", error.message);
      }
    );
  };

  const handleTestConfig1 = () => {
    setRNConfiguration({
      skipPermissionRequests: true,
      authorizationLevel: "always",
      enableBackgroundLocationUpdates: true,
      locationProvider: "playServices"
    });
    Alert.alert(
      "Success",
      "Configuration 1 set: skipPermissionRequests=true, always, playServices"
    );
  };

  const handleTestConfig2 = () => {
    setRNConfiguration({
      skipPermissionRequests: false,
      authorizationLevel: "whenInUse",
      locationProvider: "android"
    });
    Alert.alert(
      "Success",
      "Configuration 2 set: skipPermissionRequests=false, whenInUse, android"
    );
  };

  const handleTestConfig3 = () => {
    setRNConfiguration({
      skipPermissionRequests: false,
      locationProvider: "auto"
    });
    Alert.alert(
      "Success",
      "Configuration 3 set: skipPermissionRequests=false, auto"
    );
  };

  const handleGetCurrentPosition = () => {
    setIsLoadingPosition(true);
    setCurrentPosition(null);

    getCurrentPosition(
      (position) => {
        setIsLoadingPosition(false);
        setCurrentPosition(position);
        Alert.alert("Success", "Position retrieved!");
      },
      (error) => {
        setIsLoadingPosition(false);
        Alert.alert("Error", `Code ${error.code}: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000
      }
    );
  };

  const handleStartWatching = () => {
    if (watchId !== null) {
      Alert.alert("Info", "Already watching position");
      return;
    }

    setWatchUpdateCount(0);
    setWatchedPosition(null);

    const id = watchPosition(
      (position) => {
        setWatchedPosition(position);
        setWatchUpdateCount((count) => count + 1);
      },
      (error) => {
        Alert.alert("Watch Error", `Code ${error.code}: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 10,
        interval: 5000
      }
    );

    setWatchId(id);
    Alert.alert("Success", `Started watching (ID: ${id})`);
  };

  const handleStopWatching = () => {
    if (watchId === null) {
      Alert.alert("Info", "Not watching position");
      return;
    }

    clearWatch(watchId);
    setWatchId(null);
    Alert.alert("Success", "Stopped watching position");
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={styles.scrollView}
      >
        <View style={styles.body}>
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Nitro Geolocation Example</Text>

            <View style={styles.statusContainer}>
              <Text style={styles.statusLabel}>Permission Status:</Text>
              <Text style={styles.statusValue}>{permissionStatus}</Text>
            </View>

            <View style={styles.buttonContainer}>
              <Button
                title="Request Authorization"
                onPress={handleRequestAuthorization}
                color="#2196F3"
              />
            </View>

            <View style={styles.divider} />

            <Text style={styles.sectionSubtitle}>Configuration Tests:</Text>

            <View style={styles.buttonContainer}>
              <Button
                title="Config 1: Play Services"
                onPress={handleTestConfig1}
              />
            </View>

            <View style={styles.buttonContainer}>
              <Button
                title="Config 2: Android Native"
                onPress={handleTestConfig2}
              />
            </View>

            <View style={styles.buttonContainer}>
              <Button title="Config 3: Auto" onPress={handleTestConfig3} />
            </View>

            <View style={styles.divider} />

            <Text style={styles.sectionSubtitle}>Get Current Position:</Text>

            <View style={styles.buttonContainer}>
              <Button
                title={
                  isLoadingPosition ? "Loading..." : "Get Current Position"
                }
                onPress={handleGetCurrentPosition}
                disabled={isLoadingPosition}
                color="#4CAF50"
              />
            </View>

            {currentPosition && (
              <View style={styles.positionContainer}>
                <Text style={styles.positionTitle}>Current Position:</Text>
                <Text style={styles.positionText}>
                  Latitude: {currentPosition.coords.latitude.toFixed(6)}
                </Text>
                <Text style={styles.positionText}>
                  Longitude: {currentPosition.coords.longitude.toFixed(6)}
                </Text>
                <Text style={styles.positionText}>
                  Accuracy: {currentPosition.coords.accuracy.toFixed(2)}m
                </Text>
                {currentPosition.coords.altitude !== null && (
                  <Text style={styles.positionText}>
                    Altitude: {currentPosition.coords.altitude.toFixed(2)}m
                  </Text>
                )}
                {currentPosition.coords.speed !== null && (
                  <Text style={styles.positionText}>
                    Speed: {currentPosition.coords.speed.toFixed(2)}m/s
                  </Text>
                )}
                {currentPosition.coords.heading !== null && (
                  <Text style={styles.positionText}>
                    Heading: {currentPosition.coords.heading.toFixed(2)}°
                  </Text>
                )}
                <Text style={styles.positionText}>
                  Timestamp:{" "}
                  {new Date(currentPosition.timestamp).toLocaleString()}
                </Text>
              </View>
            )}

            <View style={styles.divider} />

            <Text style={styles.sectionSubtitle}>Watch Position:</Text>

            <View style={styles.statusContainer}>
              <Text style={styles.statusLabel}>Watch Status:</Text>
              <Text style={styles.statusValue}>
                {watchId !== null
                  ? `Watching 🟢 (ID: ${watchId})`
                  : "Not Watching 🔴"}
              </Text>
              {watchId !== null && (
                <Text style={styles.statusLabel}>
                  Updates: {watchUpdateCount}
                </Text>
              )}
            </View>

            <View style={styles.buttonContainer}>
              <Button
                title="Start Watching"
                onPress={handleStartWatching}
                disabled={watchId !== null}
                color="#FF9800"
              />
            </View>

            <View style={styles.buttonContainer}>
              <Button
                title="Stop Watching"
                onPress={handleStopWatching}
                disabled={watchId === null}
                color="#F44336"
              />
            </View>

            {watchedPosition && (
              <View style={styles.watchedPositionContainer}>
                <Text style={styles.watchedPositionTitle}>
                  Watched Position (Live):
                </Text>
                <Text style={styles.positionText}>
                  Latitude: {watchedPosition.coords.latitude.toFixed(6)}
                </Text>
                <Text style={styles.positionText}>
                  Longitude: {watchedPosition.coords.longitude.toFixed(6)}
                </Text>
                <Text style={styles.positionText}>
                  Accuracy: {watchedPosition.coords.accuracy.toFixed(2)}m
                </Text>
                {watchedPosition.coords.speed !== null && (
                  <Text style={styles.positionText}>
                    Speed: {watchedPosition.coords.speed.toFixed(2)}m/s
                  </Text>
                )}
                <Text style={styles.positionText}>
                  Updated:{" "}
                  {new Date(watchedPosition.timestamp).toLocaleTimeString()}
                </Text>
              </View>
            )}

            <View style={styles.infoContainer}>
              <Text style={styles.infoTitle}>Implementation Status:</Text>
              <Text style={styles.infoText}>✅ setRNConfiguration</Text>
              <Text style={styles.infoText}>✅ requestAuthorization</Text>
              <Text style={styles.infoText}>✅ getCurrentPosition</Text>
              <Text style={styles.infoText}>✅ watchPosition</Text>
              <Text style={styles.infoText}>✅ clearWatch</Text>
              <Text style={styles.infoText}>✅ stopObserving</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  scrollView: {
    backgroundColor: "#fff"
  },
  body: {
    backgroundColor: "#fff"
  },
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
    paddingBottom: 32
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#000",
    marginBottom: 16
  },
  sectionSubtitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    marginBottom: 12,
    marginTop: 8
  },
  statusContainer: {
    backgroundColor: "#e3f2fd",
    padding: 16,
    borderRadius: 8,
    marginBottom: 16
  },
  statusLabel: {
    fontSize: 14,
    color: "#1976d2",
    fontWeight: "600",
    marginBottom: 4
  },
  statusValue: {
    fontSize: 18,
    color: "#000",
    fontWeight: "700"
  },
  buttonContainer: {
    marginVertical: 6
  },
  divider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginVertical: 16
  },
  infoContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: "#f5f5f5",
    borderRadius: 8
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 8
  },
  infoText: {
    fontSize: 14,
    color: "#333",
    marginVertical: 3
  },
  positionContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: "#e8f5e9",
    borderRadius: 8
  },
  positionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2e7d32",
    marginBottom: 8
  },
  positionText: {
    fontSize: 14,
    color: "#1b5e20",
    marginVertical: 2
  },
  watchedPositionContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: "#fff3e0",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#FF9800"
  },
  watchedPositionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e65100",
    marginBottom: 8
  }
});
