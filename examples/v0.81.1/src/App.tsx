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
import { setRNConfiguration, requestAuthorization } from "react-native-nitro-geolocation";

export default function App() {
  const [permissionStatus, setPermissionStatus] = useState<string>("Unknown");

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
              <Button
                title="Config 3: Auto"
                onPress={handleTestConfig3}
              />
            </View>

            <View style={styles.infoContainer}>
              <Text style={styles.infoTitle}>Implementation Status:</Text>
              <Text style={styles.infoText}>✅ setRNConfiguration</Text>
              <Text style={styles.infoText}>✅ requestAuthorization</Text>
              <Text style={styles.infoText}>⏳ getCurrentPosition (not yet)</Text>
              <Text style={styles.infoText}>⏳ watchPosition (not yet)</Text>
              <Text style={styles.infoText}>⏳ clearWatch (not yet)</Text>
              <Text style={styles.infoText}>⏳ stopObserving (not yet)</Text>
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
  }
});
