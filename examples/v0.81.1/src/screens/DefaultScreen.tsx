import React, { useEffect, useState } from "react";
import { Switch, Text, View } from "react-native";
import {
  getCurrentPosition,
  useWatchPosition
} from "react-native-nitro-geolocation";
import type { GeolocationResponse } from "react-native-nitro-geolocation";
import {
  ButtonRow,
  ErrorBlock,
  PositionInfo,
  ScenarioButton,
  ScenarioScreen,
  ScenarioSection,
  StatusBlock,
  runWithNativeGeolocation,
  sharedStyles,
  usePermissionStatus
} from "./scenario";

type DefaultScreenSection = "permission" | "currentPosition" | "watchPosition";

interface DefaultScreenProps {
  nativeGeolocation?: boolean;
  sections?: DefaultScreenSection[];
  subtitle?: string;
  title?: string;
}

const defaultSections: DefaultScreenSection[] = [
  "permission",
  "currentPosition",
  "watchPosition"
];

export default function DefaultScreen({
  nativeGeolocation = false,
  sections = defaultSections,
  subtitle = "Root API",
  title = "Geolocation API"
}: DefaultScreenProps) {
  // Permission state
  const {
    permissionStatus,
    refreshPermission,
    requestLocationPermission,
    setPermissionStatus
  } = usePermissionStatus();
  const [isPermissionLoading, setIsPermissionLoading] = useState(false);

  // Current position state
  const [currentPosition, setCurrentPosition] =
    useState<GeolocationResponse | null>(null);
  const [isCurrentPositionLoading, setIsCurrentPositionLoading] =
    useState(false);
  const [currentPositionError, setCurrentPositionError] = useState<
    string | null
  >(null);

  // Watch position hook (continuous)
  const [watchEnabled, setWatchEnabled] = useState(false);
  useEffect(() => {
    if (!nativeGeolocation) return;

    const previousDevtoolsEnabled = globalThis.__geolocationDevToolsEnabled;
    globalThis.__geolocationDevToolsEnabled = false;

    return () => {
      globalThis.__geolocationDevToolsEnabled = previousDevtoolsEnabled;
    };
  }, [nativeGeolocation]);

  const {
    position: watchedPosition,
    error: watchError,
    isWatching
  } = useWatchPosition({
    enabled: watchEnabled,
    enableHighAccuracy: true,
    distanceFilter: 10,
    interval: 5000
  });

  const handleCheckPermission = async () => {
    try {
      await refreshPermission();
    } catch (err) {
      setPermissionStatus("error");
    }
  };

  const handleRequestPermission = async () => {
    setIsPermissionLoading(true);
    try {
      await requestLocationPermission();
    } catch (err) {
      console.error("Permission request failed:", err);
      setPermissionStatus("error");
    } finally {
      setIsPermissionLoading(false);
    }
  };

  const handleFetchPosition = async () => {
    setIsCurrentPositionLoading(true);
    setCurrentPosition(null);
    setCurrentPositionError(null);
    try {
      const position = await (nativeGeolocation
        ? runWithNativeGeolocation(() =>
            getCurrentPosition({
              enableHighAccuracy: true,
              timeout: 15000
            })
          )
        : getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 15000
          }));
      setCurrentPosition(position);
    } catch (err: any) {
      setCurrentPositionError(err?.message || "Unknown error");
    } finally {
      setIsCurrentPositionLoading(false);
    }
  };

  const renderPermissionSection = (divided: boolean) => (
    <ScenarioSection
      index={1}
      title="Permission Management"
      description="Check and request location permissions"
      divided={divided}
    >
      <StatusBlock
        rows={[
          {
            label: "Status:",
            value: `${permissionStatus}${
              permissionStatus === "granted"
                ? " ✅"
                : permissionStatus === "denied"
                  ? " ❌"
                  : ""
            }`
          }
        ]}
      />
      <ButtonRow>
        <ScenarioButton
          title="Check"
          onPress={handleCheckPermission}
          color="#2196F3"
          containerStyle={sharedStyles.button}
        />
        <ScenarioButton
          title={isPermissionLoading ? "Requesting..." : "Request"}
          onPress={handleRequestPermission}
          disabled={isPermissionLoading}
          color="#4CAF50"
          containerStyle={sharedStyles.button}
        />
      </ButtonRow>
    </ScenarioSection>
  );

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
        accuracy: "accuracy-text",
        mocked: "mocked-text",
        provider: "provider-text"
      }}
    />
  );

  const renderCurrentPositionSection = (divided: boolean) => (
    <ScenarioSection
      index={2}
      title="Get Current Position"
      description="One-time location request using getCurrentPosition()"
      divided={divided}
    >
      {currentPositionError && (
        <ErrorBlock
          message={currentPositionError}
          testID="current-position-error"
          textTestID="current-position-error-text"
        />
      )}
      <ScenarioButton
        title={isCurrentPositionLoading ? "Loading..." : "Get Position"}
        onPress={handleFetchPosition}
        disabled={isCurrentPositionLoading}
        color="#4CAF50"
      />
      {renderPositionInfo(currentPosition, "Current Position")}
    </ScenarioSection>
  );

  const renderWatchPositionSection = (divided: boolean) => (
    <ScenarioSection
      index={3}
      title="Watch Position (Hook)"
      description="Continuous location tracking with useWatchPosition()"
      divided={divided}
    >
      <View style={sharedStyles.toggleContainer}>
        <Text style={sharedStyles.toggleLabel}>Enable Watching:</Text>
        <Switch
          testID="watch-toggle-switch"
          value={watchEnabled}
          onValueChange={setWatchEnabled}
        />
      </View>
      <StatusBlock
        rows={[
          {
            label: "Status:",
            value: isWatching ? "Watching 🟢" : "Not Watching 🔴",
            testID: "watch-status"
          }
        ]}
      />
      {watchError && (
        <ErrorBlock
          message={watchError.message}
          testID="watch-position-error"
          textTestID="watch-position-error-text"
        />
      )}
      {renderPositionInfo(watchedPosition, "Watched Position (Live)")}
    </ScenarioSection>
  );

  const renderSection = (section: DefaultScreenSection, divided: boolean) => {
    switch (section) {
      case "permission":
        return renderPermissionSection(divided);
      case "currentPosition":
        return renderCurrentPositionSection(divided);
      case "watchPosition":
        return renderWatchPositionSection(divided);
    }
  };

  return (
    <ScenarioScreen prefix="default" title={title} subtitle={subtitle}>
      {sections.map((section, index) => (
        <React.Fragment key={section}>
          {renderSection(section, index > 0)}
        </React.Fragment>
      ))}
    </ScenarioScreen>
  );
}
