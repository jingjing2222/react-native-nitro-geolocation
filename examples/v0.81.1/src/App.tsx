import {
  type Position,
  createPosition,
  useGeolocationDevTools
} from "@react-native-nitro-geolocation/rozenite-plugin";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import React from "react";
import AccuracyPresetsScreen from "./screens/AccuracyPresetsScreen";
import AndroidRequestOptionsScreen from "./screens/AndroidRequestOptionsScreen";
import ApiErrorsScreen from "./screens/ApiErrorsScreen";
import BackgroundE2EScreen from "./screens/BackgroundE2EScreen";
import CompatScreen from "./screens/CompatScreen";
import CurrentPositionScreen from "./screens/CurrentPositionScreen";
import DefaultScreen from "./screens/DefaultScreen";
import GeocodingScreen from "./screens/GeocodingScreen";
import HeadingScreen from "./screens/HeadingScreen";
import IOSAccuracyAuthorizationScreen from "./screens/IOSAccuracyAuthorizationScreen";
import IOSLocationTuningScreen from "./screens/IOSLocationTuningScreen";
import IOSReleaseOptionsBridgeScreen from "./screens/IOSReleaseOptionsBridgeScreen";
import Issue67Screen from "./screens/Issue67Screen";
import LastKnownPositionScreen from "./screens/LastKnownPositionScreen";
import LocationAvailabilityScreen from "./screens/LocationAvailabilityScreen";
import LocationSimulationScreen from "./screens/LocationSimulationScreen";
import MockedMetadataScreen from "./screens/MockedMetadataScreen";
import PermissionCheckScreen from "./screens/PermissionCheckScreen";
import ProviderSettingsScreen from "./screens/ProviderSettingsScreen";
import WatchPositionScreen from "./screens/WatchPositionScreen";
import WebE2EScreen from "./screens/WebE2EScreen";

const Tab = createBottomTabNavigator();
const linking = {
  prefixes: ["nitrogeolocation://app"],
  config: {
    screens: {
      Default: "",
      Compat: "compat",
      PermissionCheck: "permission-check",
      CurrentPosition: "current-position",
      WatchPosition: "watch-position",
      LocationSimulation: "location-simulation",
      MockedMetadata: "mocked-metadata",
      ProviderSettings: "provider-settings",
      ApiErrors: "api-errors",
      AccuracyPresets: "accuracy-presets",
      LastKnownPosition: "last-known-position",
      Geocoding: "geocoding",
      LocationAvailability: "location-availability",
      Heading: "heading",
      AndroidRequestOptions: "android-request-options",
      BackgroundE2E: "background-e2e",
      IOSLocationTuning: "ios-location-tuning",
      IOSAccuracyAuthorization: "ios-accuracy-authorization",
      IOSReleaseOptionsBridge: "ios-release-options-bridge",
      WebE2E: "web-e2e",
      Issue67: "issue-67"
    }
  }
};
const hiddenTabOptions = {
  tabBarButton: () => null
};

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
  if (__DEV__) {
    useGeolocationDevTools({
      initialPosition
    });
  }

  return (
    <NavigationContainer linking={linking}>
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
          name="Issue67"
          component={Issue67Screen}
          options={hiddenTabOptions}
        />
        <Tab.Screen
          name="PermissionCheck"
          component={PermissionCheckScreen}
          options={hiddenTabOptions}
        />
        <Tab.Screen
          name="CurrentPosition"
          component={CurrentPositionScreen}
          options={hiddenTabOptions}
        />
        <Tab.Screen
          name="WatchPosition"
          component={WatchPositionScreen}
          options={hiddenTabOptions}
        />
        <Tab.Screen
          name="LocationSimulation"
          component={LocationSimulationScreen}
          options={hiddenTabOptions}
        />
        <Tab.Screen
          name="MockedMetadata"
          component={MockedMetadataScreen}
          options={hiddenTabOptions}
        />
        <Tab.Screen
          name="ProviderSettings"
          component={ProviderSettingsScreen}
          options={hiddenTabOptions}
        />
        <Tab.Screen
          name="ApiErrors"
          component={ApiErrorsScreen}
          options={hiddenTabOptions}
        />
        <Tab.Screen
          name="AccuracyPresets"
          component={AccuracyPresetsScreen}
          options={hiddenTabOptions}
        />
        <Tab.Screen
          name="LastKnownPosition"
          component={LastKnownPositionScreen}
          options={hiddenTabOptions}
        />
        <Tab.Screen
          name="Geocoding"
          component={GeocodingScreen}
          options={hiddenTabOptions}
        />
        <Tab.Screen
          name="LocationAvailability"
          component={LocationAvailabilityScreen}
          options={hiddenTabOptions}
        />
        <Tab.Screen
          name="Heading"
          component={HeadingScreen}
          options={hiddenTabOptions}
        />
        <Tab.Screen
          name="AndroidRequestOptions"
          component={AndroidRequestOptionsScreen}
          options={hiddenTabOptions}
        />
        <Tab.Screen
          name="BackgroundE2E"
          component={BackgroundE2EScreen}
          options={hiddenTabOptions}
        />
        <Tab.Screen
          name="IOSLocationTuning"
          component={IOSLocationTuningScreen}
          options={hiddenTabOptions}
        />
        <Tab.Screen
          name="IOSAccuracyAuthorization"
          component={IOSAccuracyAuthorizationScreen}
          options={hiddenTabOptions}
        />
        <Tab.Screen
          name="IOSReleaseOptionsBridge"
          component={IOSReleaseOptionsBridgeScreen}
          options={hiddenTabOptions}
        />
        <Tab.Screen
          name="WebE2E"
          component={WebE2EScreen}
          options={hiddenTabOptions}
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
