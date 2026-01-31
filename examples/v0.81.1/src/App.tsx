import {
  type Position,
  createPosition,
  useGeolocationDevTools
} from "@react-native-nitro-geolocation/rozenite-plugin";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import React from "react";
import CompatScreen from "./screens/CompatScreen";
import DefaultScreen from "./screens/DefaultScreen";

const Tab = createBottomTabNavigator();

const initialPosition = createPosition("Los Angeles, USA");
const customPosition: Position = {
  coords: {
    latitude: 34.052235,
    longitude: -118.243683,
    accuracy: 100,
    altitude: 0,
    altitudeAccuracy: 0,
    heading: 0,
    speed: 0
  },
  timestamp: Date.now()
};

export default function App() {
  useGeolocationDevTools({
    initialPosition
  });

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
