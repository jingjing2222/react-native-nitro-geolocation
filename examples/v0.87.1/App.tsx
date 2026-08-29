/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { useState } from "react";
import {
  Button,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text
} from "react-native";
import { checkPermission } from "react-native-nitro-geolocation";

function App() {
  const [permission, setPermission] = useState("not checked");

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Text style={styles.title}>RN 0.87.1 SwiftPM Consumer</Text>
      <Text testID="permission-status">Permission: {permission}</Text>
      <Button
        title="Check location permission"
        onPress={() => {
          void checkPermission().then(setPermission);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16
  },
  title: {
    fontSize: 20,
    fontWeight: "600"
  }
});

export default App;
