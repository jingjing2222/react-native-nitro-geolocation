import { useRozeniteDevToolsClient } from "@rozenite/plugin-bridge";
import { Button, SafeAreaView, ScrollView, StyleSheet } from "react-native";
import type { GeolocationPluginEvents } from "../shared/types";

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
          title="helloworld"
          onPress={() => {
            client?.send("helloworld", { message: "Hello World!" });
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
