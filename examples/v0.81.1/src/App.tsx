import {
  createPosition,
  useGeolocationDevTools
} from "@react-native-nitro-geolocation/rozenite-plugin";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AccuracyPresetsScreen from "./screens/AccuracyPresetsScreen";
import AndroidRequestOptionsScreen, {
  AndroidRequestOptionsErrorScreen,
  AndroidRequestOptionsProviderScreen,
  AndroidRequestOptionsWatchScreen
} from "./screens/AndroidRequestOptionsScreen";
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
import Issue119Screen from "./screens/Issue119Screen";
import Issue120Screen from "./screens/Issue120Screen";
import Issue121Screen from "./screens/Issue121Screen";
import Issue122Screen from "./screens/Issue122Screen";
import Issue132Screen from "./screens/Issue132Screen";
import LastKnownPositionScreen from "./screens/LastKnownPositionScreen";
import LocationAvailabilityScreen from "./screens/LocationAvailabilityScreen";
import LocationSimulationScreen from "./screens/LocationSimulationScreen";
import { LongRunBackgroundE2EScreen } from "./screens/LongRunBackgroundE2EScreen";
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
      AndroidRequestOptionsProviders: "android-request-options/providers",
      AndroidRequestOptionsWatches: "android-request-options/watches",
      AndroidRequestOptionsErrors: "android-request-options/errors",
      BackgroundE2E: "background-e2e",
      LongRunBackgroundE2E: "background-long-run",
      IOSLocationTuning: "ios-location-tuning",
      IOSAccuracyAuthorization: "ios-accuracy-authorization",
      IOSReleaseOptionsBridge: "ios-release-options-bridge",
      Issue119: "issue-119",
      Issue120: "issue-120",
      Issue121: "issue-121",
      Issue122: "issue-122",
      Issue132: "issue-132",
      WebE2E: "web-e2e",
      Issue67: "issue-67"
    }
  }
};
const hiddenTabOptions = {
  tabBarButton: () => null,
  tabBarStyle: {
    display: "none" as const
  }
};

const initialPosition = createPosition("Los Angeles, USA");

export default function App() {
  if (__DEV__) {
    useGeolocationDevTools({
      initialPosition
    });
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer linking={linking}>
        <Tab.Navigator
          tabBar={() => null}
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              display: "none" as const
            },
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
            name="AndroidRequestOptionsProviders"
            component={AndroidRequestOptionsProviderScreen}
            options={hiddenTabOptions}
          />
          <Tab.Screen
            name="AndroidRequestOptionsWatches"
            component={AndroidRequestOptionsWatchScreen}
            options={hiddenTabOptions}
          />
          <Tab.Screen
            name="AndroidRequestOptionsErrors"
            component={AndroidRequestOptionsErrorScreen}
            options={hiddenTabOptions}
          />
          <Tab.Screen
            name="BackgroundE2E"
            component={BackgroundE2EScreen}
            options={hiddenTabOptions}
          />
          <Tab.Screen
            name="LongRunBackgroundE2E"
            component={LongRunBackgroundE2EScreen}
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
            name="Issue119"
            component={Issue119Screen}
            options={hiddenTabOptions}
          />
          <Tab.Screen
            name="Issue120"
            component={Issue120Screen}
            options={hiddenTabOptions}
          />
          <Tab.Screen
            name="Issue121"
            component={Issue121Screen}
            options={hiddenTabOptions}
          />
          <Tab.Screen
            name="Issue122"
            component={Issue122Screen}
            options={hiddenTabOptions}
          />
          <Tab.Screen
            name="Issue132"
            component={Issue132Screen}
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
    </SafeAreaProvider>
  );
}
