import React, { useEffect } from "react";
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Button,
  Alert
} from "react-native";
import { setRNConfiguration } from "react-native-nitro-geolocation";

export default function App() {
  useEffect(() => {
    // Configure geolocation
    setRNConfiguration({
      skipPermissionRequests: false,
      authorizationLevel: "whenInUse",
      locationProvider: "auto"
    });
  }, []);

  const handleTestConfig1 = () => {
    setRNConfiguration({
      skipPermissionRequests: true,
      authorizationLevel: "always",
      enableBackgroundLocationUpdates: true,
      locationProvider: "playServices"
    });
    Alert.alert("Success", "Configuration 1 set: skipPermissionRequests=true, always, playServices");
  };

  const handleTestConfig2 = () => {
    setRNConfiguration({
      skipPermissionRequests: false,
      authorizationLevel: "whenInUse",
      locationProvider: "android"
    });
    Alert.alert("Success", "Configuration 2 set: skipPermissionRequests=false, whenInUse, android");
  };

  const handleTestConfig3 = () => {
    setRNConfiguration({
      skipPermissionRequests: false,
      locationProvider: "auto"
    });
    Alert.alert("Success", "Configuration 3 set: skipPermissionRequests=false, auto");
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
            <Text style={styles.sectionDescription}>
              Testing setRNConfiguration method
            </Text>

            <View style={styles.buttonContainer}>
              <Button title="Test Config 1 (Play Services)" onPress={handleTestConfig1} />
            </View>

            <View style={styles.buttonContainer}>
              <Button title="Test Config 2 (Android)" onPress={handleTestConfig2} />
            </View>

            <View style={styles.buttonContainer}>
              <Button title="Test Config 3 (Auto)" onPress={handleTestConfig3} />
            </View>

            <View style={styles.infoContainer}>
              <Text style={styles.infoTitle}>Current Implementation:</Text>
              <Text style={styles.infoText}>✅ setRNConfiguration</Text>
              <Text style={styles.infoText}>⏳ requestAuthorization (not yet)</Text>
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
    paddingHorizontal: 24
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#000",
    marginBottom: 8
  },
  sectionDescription: {
    fontSize: 16,
    color: "#666",
    marginBottom: 16
  },
  buttonContainer: {
    marginVertical: 8
  },
  infoContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: "#f5f5f5",
    borderRadius: 8
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    marginBottom: 8
  },
  infoText: {
    fontSize: 14,
    color: "#333",
    marginVertical: 2
  }
});
