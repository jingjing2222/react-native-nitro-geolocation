import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GeolocationProvider } from 'react-native-nitro-geolocation';
import DefaultScreen from './screens/DefaultScreen';
import CompatScreen from './screens/CompatScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <GeolocationProvider
      config={{
        authorizationLevel: 'whenInUse',
        enableBackgroundLocationUpdates: false,
        locationProvider: 'auto',
      }}
    >
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#2196F3',
            tabBarInactiveTintColor: '#757575',
          }}
        >
          <Tab.Screen
            name="Default"
            component={DefaultScreen}
            options={{
              tabBarLabel: 'Default API',
            }}
          />
          <Tab.Screen
            name="Compat"
            component={CompatScreen}
            options={{
              tabBarLabel: 'Compat API',
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </GeolocationProvider>
  );
}
