import { useRozeniteDevToolsClient } from "@rozenite/plugin-bridge";
import { Button, SafeAreaView, ScrollView, StyleSheet } from "react-native";
import type { GeolocationPluginEvents, Position } from "../shared/types";

const DEFAULT_POSITION:Position = {
  latitude: 0,
  longitude: 0,
  accuracy: 0,
  altitude: 0,
  altitudeAccuracy: 0,
  heading: 0,
  speed: 0,
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
