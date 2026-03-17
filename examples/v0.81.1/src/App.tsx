import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import React from "react";
import CompatScreen from "./screens/CompatScreen";
import DefaultScreen from "./screens/DefaultScreen";

const Tab = createBottomTabNavigator();

function useExampleGeolocationDevTools() {
  if (!__DEV__) {
    return;
  }

  const { createPosition, useGeolocationDevTools } = require("@react-native-nitro-geolocation/rozenite-plugin") as typeof import("@react-native-nitro-geolocation/rozenite-plugin");

  useGeolocationDevTools({
    initialPosition: createPosition("Los Angeles, USA")
  });
}

export default function App() {
  useExampleGeolocationDevTools();

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#2196F3",
          tabBarInactiveTintColor: "#757575"
        }}
      >
        <Tab.Screen
          name="Default"
          component={DefaultScreen}
          options={{
            tabBarLabel: "Default API"
          }}
        />
        <Tab.Screen
          name="Compat"
          component={CompatScreen}
          options={{
            tabBarLabel: "Compat API"
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
