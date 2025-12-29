import { useRozeniteDevToolsClient } from "@rozenite/plugin-bridge";
import { Button, SafeAreaView, ScrollView, StyleSheet } from "react-native";
import type { GeolocationPluginEvents, Position } from "../shared/types";

const DEFAULT_POSITION: Position = {
  coords: {
    latitude: 37.5665,
    longitude: 126.978,
    accuracy: 10,
    altitude: 50,
    altitudeAccuracy: 5,
    heading: 45,
    speed: 1.5
  },
  timestamp: Date.now()
};

export default function HelloWorldPanel() {
  const client = useRozeniteDevToolsClient<GeolocationPluginEvents>({
    pluginId: "@rozenite/react-native-nitro-geolocation-plugin"
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <Button
          title="position"
          onPress={() => {
            client?.send("position", DEFAULT_POSITION);
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa"
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: 20
  }
});
