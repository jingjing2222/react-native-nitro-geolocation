import React from "react";
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Button,
} from "react-native";
import {
  addtion,
  division,
  multiply,
  subtraction,
} from "react-native-nitro-geolocation";

export default function App() {
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
              addtion 4 + 5: {addtion(4, 5)}
            </Text>
            <Text style={styles.sectionDescription}>
              subtraction 4 - 5: {subtraction(4, 5)}
            </Text>
            <Text style={styles.sectionDescription}>
              multiply 4 * 5: {multiply(4, 5)}
            </Text>
            <Text style={styles.sectionDescription}>
              division 4 / 5: {division(4, 5)}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    backgroundColor: "#fff",
  },
  body: {
    backgroundColor: "#fff",
  },
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#000",
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "400",
    color: "#666",
  },
});
