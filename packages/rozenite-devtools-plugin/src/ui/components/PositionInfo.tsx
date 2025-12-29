import { StyleSheet, Text, View } from "react-native";
import type { Position } from "../../shared/types";

interface PositionInfoProps {
  position: Position;
}

export function PositionInfo({ position }: PositionInfoProps) {
  return (
    <View style={styles.positionInfo}>
      <Text style={styles.infoTitle}>Current Position</Text>
      <Text style={styles.infoText}>
        Lat: {position.coords.latitude.toFixed(6)}
      </Text>
      <Text style={styles.infoText}>
        Lng: {position.coords.longitude.toFixed(6)}
      </Text>
      <Text style={styles.infoText}>Accuracy: {position.coords.accuracy}m</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  positionInfo: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10
  },
  infoText: {
    fontSize: 14,
    marginBottom: 5
  }
});
