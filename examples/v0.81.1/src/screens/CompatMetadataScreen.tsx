import React, { useState } from "react";
import { Button, ScrollView, StyleSheet, Text, View } from "react-native";
import GeolocationCompat, {
  type GeolocationResponse
} from "react-native-nitro-geolocation/compat";

type MetadataStatus = "unknown" | "absent" | "present" | "error";

export default function CompatMetadataScreen() {
  const [metadataStatus, setMetadataStatus] =
    useState<MetadataStatus>("unknown");
  const [position, setPosition] = useState<GeolocationResponse | null>(null);

  const handleFetchPosition = () => {
    setMetadataStatus("unknown");
    setPosition(null);

    GeolocationCompat.getCurrentPosition(
      (nextPosition) => {
        const hasMetadata =
          Object.prototype.hasOwnProperty.call(nextPosition, "mocked") ||
          Object.prototype.hasOwnProperty.call(nextPosition, "provider");

        setPosition(nextPosition);
        setMetadataStatus(hasMetadata ? "present" : "absent");
      },
      () => {
        setMetadataStatus("error");
      },
      {
        enableHighAccuracy: true,
        timeout: 15000
      }
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Compat Metadata Contract</Text>
        <Text style={styles.subtitle}>Legacy response remains unchanged</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.buttonContainer}>
          <Button
            title="Get Position"
            onPress={handleFetchPosition}
            color="#4CAF50"
          />
        </View>

        <Text style={styles.statusText} testID="compat-metadata-status">
          Compat metadata: {metadataStatus}
        </Text>

        {position && (
          <View style={styles.positionContainer} testID="position-info">
            <Text style={styles.positionText} testID="latitude-text">
              Latitude: {position.coords.latitude.toFixed(6)}
            </Text>
            <Text style={styles.positionText} testID="longitude-text">
              Longitude: {position.coords.longitude.toFixed(6)}
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
    backgroundColor: "#f5f5f5"
  },
  header: {
    backgroundColor: "#2196F3",
    padding: 20,
    paddingTop: 50,
    alignItems: "center"
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "white",
    marginBottom: 8
  },
  subtitle: {
    fontSize: 16,
    color: "white",
    opacity: 0.9
  },
  section: {
    backgroundColor: "white",
    margin: 16,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2
  },
  buttonContainer: {
    marginVertical: 8
  },
  statusText: {
    fontSize: 16,
    color: "#333",
    marginTop: 12
  },
  positionContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#e8f5e8",
    borderRadius: 6
  },
  positionText: {
    fontSize: 14,
    color: "#333",
    marginBottom: 4
  }
});
