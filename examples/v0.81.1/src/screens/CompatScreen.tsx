import React, { useEffect, useState } from "react";
import { Alert, Text } from "react-native";
import GeolocationCompat, {
  type GeolocationResponse
} from "react-native-nitro-geolocation/compat";
import {
  ButtonRow,
  KeyValueBlock,
  PositionInfo,
  ScenarioButton,
  ScenarioScreen,
  ScenarioSection,
  StatusBlock,
  sharedStyles
} from "./scenario";

export default function CompatScreen() {
  const [permissionStatus, setPermissionStatus] = useState<string>("Unknown");
  const [currentPosition, setCurrentPosition] =
    useState<GeolocationResponse | null>(null);
  const [isLoadingPosition, setIsLoadingPosition] = useState(false);

  const [watchId, setWatchId] = useState<number | null>(null);
  const [watchedPosition, setWatchedPosition] =
    useState<GeolocationResponse | null>(null);
  const [watchUpdateCount, setWatchUpdateCount] = useState(0);

  useEffect(() => {
    GeolocationCompat.setRNConfiguration({
      skipPermissionRequests: false,
      authorizationLevel: "whenInUse",
      locationProvider: "auto"
    });
  }, []);

  const handleRequestAuthorization = () => {
    setPermissionStatus("Requesting...");
    GeolocationCompat.requestAuthorization(
      () => {
        setPermissionStatus("Granted ✅");
        Alert.alert("Success", "Location permission granted!");
      },
      (error) => {
        setPermissionStatus(`Denied ❌ (Code: ${error.code})`);
        Alert.alert("Error", error.message);
      }
    );
  };

  const handleGetCurrentPosition = () => {
    setIsLoadingPosition(true);
    setCurrentPosition(null);

    GeolocationCompat.getCurrentPosition(
      (position) => {
        setIsLoadingPosition(false);
        setCurrentPosition(position);
      },
      (error) => {
        setIsLoadingPosition(false);
        Alert.alert("Error", `Code ${error.code}: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000
      }
    );
  };

  const handleStartWatching = () => {
    if (watchId !== null) {
      Alert.alert("Info", "Already watching position");
      return;
    }

    setWatchUpdateCount(0);
    setWatchedPosition(null);

    const id = GeolocationCompat.watchPosition(
      (position) => {
        setWatchedPosition(position);
        setWatchUpdateCount((count) => count + 1);
      },
      (error) => {
        Alert.alert("Watch Error", `Code ${error.code}: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 10,
        interval: 5000
      }
    );

    setWatchId(id);
  };

  const handleStopWatching = () => {
    if (watchId === null) {
      Alert.alert("Info", "Not watching position");
      return;
    }

    GeolocationCompat.clearWatch(watchId);
    setWatchId(null);
  };

  const renderPositionInfo = (
    position: GeolocationResponse | null,
    title: string
  ) => (
    <PositionInfo
      title={title}
      position={position}
      testIDs={{
        container: "position-info",
        latitude: "latitude-text",
        longitude: "longitude-text",
        accuracy: "accuracy-text"
      }}
    />
  );

  return (
    <ScenarioScreen
      prefix="compat"
      title="Compat API"
      subtitle="Compat callback-based API compatible with @react-native-community/geolocation"
    >
      <ScenarioSection index={1} title="Permission Status">
        <StatusBlock
          rows={[
            {
              label: "Permission Status:",
              value: permissionStatus
            }
          ]}
        />
        <ScenarioButton
          title="Request Authorization"
          onPress={handleRequestAuthorization}
          color="#2196F3"
        />
      </ScenarioSection>

      <ScenarioSection
        index={2}
        title="Get Current Position (One-time)"
        divided
      >
        <ScenarioButton
          title={isLoadingPosition ? "Loading..." : "Get Current Position"}
          onPress={handleGetCurrentPosition}
          disabled={isLoadingPosition}
          color="#4CAF50"
        />
        {renderPositionInfo(currentPosition, "Current Position")}
      </ScenarioSection>

      <ScenarioSection index={3} title="Watch Position (Continuous)" divided>
        <StatusBlock
          rows={[
            {
              label: "Watch Status:",
              value:
                watchId !== null
                  ? `Watching 🟢 (ID: ${watchId})`
                  : "Not Watching 🔴"
            },
            ...(watchId !== null
              ? [
                  {
                    label: "Updates:",
                    value: watchUpdateCount
                  }
                ]
              : [])
          ]}
        />
        <ButtonRow>
          <ScenarioButton
            title="Start Watching"
            onPress={handleStartWatching}
            disabled={watchId !== null}
            color="#FF9800"
            containerStyle={sharedStyles.button}
          />
          <ScenarioButton
            title="Stop Watching"
            onPress={handleStopWatching}
            disabled={watchId === null}
            color="#F44336"
            containerStyle={sharedStyles.button}
          />
        </ButtonRow>
        {renderPositionInfo(watchedPosition, "Watched Position (Live)")}
      </ScenarioSection>

      <ScenarioSection index={4} title="Features" divided>
        <KeyValueBlock
          rows={[
            { label: "setRNConfiguration", value: "supported" },
            { label: "requestAuthorization", value: "supported" },
            { label: "getCurrentPosition", value: "supported" },
            { label: "watchPosition / clearWatch", value: "supported" },
            { label: "stopObserving", value: "supported" }
          ]}
        />
        <Text style={sharedStyles.resultMessage}>
          ⚠️ Manual subscription management required
        </Text>
      </ScenarioSection>
    </ScenarioScreen>
  );
}
