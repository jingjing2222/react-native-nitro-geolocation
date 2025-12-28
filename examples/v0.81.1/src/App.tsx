import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import React, { useEffect } from "react";
import { setConfiguration } from "react-native-nitro-geolocation";
import CompatScreen from "./screens/CompatScreen";
import DefaultScreen from "./screens/DefaultScreen";

const Tab = createBottomTabNavigator();

console.log(process.env.WITH_ROZENITE)

export default function App() {
  // Set configuration once on app startup
  useEffect(() => {
    setConfiguration({
      authorizationLevel: "whenInUse",
      enableBackgroundLocationUpdates: false,
      locationProvider: "auto"
    });
  }, []);

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
