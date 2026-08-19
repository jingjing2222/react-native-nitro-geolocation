import React, { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import Geolocation from "react-native-nitro-geolocation/compat";
import type {
  GeolocationResponse,
  GeolocationResponseWithMetadata
} from "react-native-nitro-geolocation/compat";
import {
  ButtonRow,
  KeyValueBlock,
  ScenarioButton,
  ScenarioScreen,
  ScenarioSection,
  StatusBlock,
  sharedStyles
} from "./scenario";

type CompatPosition = GeolocationResponse | GeolocationResponseWithMetadata;

function PositionShape({
  position,
  testID
}: {
  position: CompatPosition | null;
  testID: string;
}) {
  if (!position) {
    return null;
  }

  const hasMocked = Object.hasOwn(position, "mocked");
  const hasProvider = Object.hasOwn(position, "provider");
  const metadata = position as GeolocationResponseWithMetadata;

  return (
    <KeyValueBlock
      testID={testID}
      rows={[
        { label: "Response keys", value: Object.keys(position).join(",") },
        { label: "Latitude", value: position.coords.latitude.toFixed(6) },
        { label: "Longitude", value: position.coords.longitude.toFixed(6) },
        { label: "Has mocked", value: String(hasMocked) },
        { label: "Has provider", value: String(hasProvider) },
        ...(hasMocked
          ? [{ label: "Mocked", value: String(metadata.mocked) }]
          : []),
        ...(hasProvider
          ? [{ label: "Provider", value: metadata.provider ?? "unknown" }]
          : [])
      ]}
    />
  );
}

export default function CompatMetadataScreen() {
  const [permissionStatus, setPermissionStatus] = useState("Unknown");
  const [defaultCurrent, setDefaultCurrent] =
    useState<GeolocationResponse | null>(null);
  const [metadataCurrent, setMetadataCurrent] =
    useState<GeolocationResponseWithMetadata | null>(null);
  const [defaultWatch, setDefaultWatch] = useState<GeolocationResponse | null>(
    null
  );
  const [metadataWatch, setMetadataWatch] =
    useState<GeolocationResponseWithMetadata | null>(null);
  const [defaultWatchId, setDefaultWatchId] = useState<number | null>(null);
  const [metadataWatchId, setMetadataWatchId] = useState<number | null>(null);
  const defaultWatchRef = useRef<number | null>(null);
  const metadataWatchRef = useRef<number | null>(null);

  useEffect(() => {
    Geolocation.setRNConfiguration({
      skipPermissionRequests: false,
      authorizationLevel: "whenInUse",
      locationProvider: "auto"
    });

    return () => {
      if (defaultWatchRef.current !== null) {
        Geolocation.clearWatch(defaultWatchRef.current);
      }
      if (metadataWatchRef.current !== null) {
        Geolocation.clearWatch(metadataWatchRef.current);
      }
    };
  }, []);

  const requestPermission = () => {
    setPermissionStatus("Requesting...");
    Geolocation.requestAuthorization(
      () => setPermissionStatus("Granted ✅"),
      (error) => {
        setPermissionStatus(`Denied ❌ (Code: ${error.code})`);
        Alert.alert("Permission Error", error.message);
      }
    );
  };

  const getDefaultCurrent = () => {
    setDefaultCurrent(null);
    Geolocation.getCurrentPosition(
      setDefaultCurrent,
      (error) => Alert.alert("Current Position Error", error.message),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  const getMetadataCurrent = () => {
    setMetadataCurrent(null);
    Geolocation.getCurrentPosition(
      setMetadataCurrent,
      (error) => Alert.alert("Metadata Position Error", error.message),
      {
        includeExtraMetadata: true,
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000
      }
    );
  };

  const startDefaultWatch = () => {
    setDefaultWatch(null);
    const watchId = Geolocation.watchPosition(
      setDefaultWatch,
      (error) => Alert.alert("Default Watch Error", error.message),
      { enableHighAccuracy: true, distanceFilter: 0, interval: 1000 }
    );
    defaultWatchRef.current = watchId;
    setDefaultWatchId(watchId);
  };

  const startMetadataWatch = () => {
    setMetadataWatch(null);
    const watchId = Geolocation.watchPosition(
      setMetadataWatch,
      (error) => Alert.alert("Metadata Watch Error", error.message),
      {
        includeExtraMetadata: true,
        enableHighAccuracy: true,
        distanceFilter: 0,
        interval: 1000
      }
    );
    metadataWatchRef.current = watchId;
    setMetadataWatchId(watchId);
  };

  const stopDefaultWatch = () => {
    if (defaultWatchRef.current !== null) {
      Geolocation.clearWatch(defaultWatchRef.current);
      defaultWatchRef.current = null;
      setDefaultWatchId(null);
    }
  };

  const stopMetadataWatch = () => {
    if (metadataWatchRef.current !== null) {
      Geolocation.clearWatch(metadataWatchRef.current);
      metadataWatchRef.current = null;
      setMetadataWatchId(null);
    }
  };

  return (
    <ScenarioScreen
      prefix="compat-metadata"
      title="Compat Metadata Opt-in"
      subtitle="Default drop-in shape and explicit per-call integrity metadata"
    >
      <ScenarioSection index={1} title="Permission">
        <StatusBlock
          rows={[{ label: "Permission Status:", value: permissionStatus }]}
        />
        <ScenarioButton
          title="Request Authorization"
          onPress={requestPermission}
          testID="compat-metadata-request-permission-button"
        />
      </ScenarioSection>

      <ScenarioSection index={2} title="Current Position" divided>
        <ScenarioButton
          title="Get Default Response"
          onPress={getDefaultCurrent}
          color="#4CAF50"
          testID="compat-default-current-button"
        />
        <PositionShape
          position={defaultCurrent}
          testID="compat-default-current-result"
        />
        <ScenarioButton
          title="Get Response with Metadata"
          onPress={getMetadataCurrent}
          color="#7B1FA2"
          testID="compat-metadata-current-button"
        />
        <PositionShape
          position={metadataCurrent}
          testID="compat-metadata-current-result"
        />
      </ScenarioSection>

      <ScenarioSection index={3} title="Concurrent Watches" divided>
        <ButtonRow>
          <ScenarioButton
            title="Start Default Watch"
            onPress={startDefaultWatch}
            disabled={defaultWatchId !== null}
            color="#FF9800"
            containerStyle={sharedStyles.button}
            testID="compat-default-watch-button"
          />
          <ScenarioButton
            title="Stop Default Watch"
            onPress={stopDefaultWatch}
            disabled={defaultWatchId === null}
            color="#F44336"
            containerStyle={sharedStyles.button}
            testID="compat-default-watch-stop-button"
          />
        </ButtonRow>
        <PositionShape
          position={defaultWatch}
          testID="compat-default-watch-result"
        />
        <ButtonRow>
          <ScenarioButton
            title="Start Metadata Watch"
            onPress={startMetadataWatch}
            disabled={metadataWatchId !== null}
            color="#7B1FA2"
            containerStyle={sharedStyles.button}
            testID="compat-metadata-watch-button"
          />
          <ScenarioButton
            title="Stop Metadata Watch"
            onPress={stopMetadataWatch}
            disabled={metadataWatchId === null}
            color="#F44336"
            containerStyle={sharedStyles.button}
            testID="compat-metadata-watch-stop-button"
          />
        </ButtonRow>
        <PositionShape
          position={metadataWatch}
          testID="compat-metadata-watch-result"
        />
      </ScenarioSection>
    </ScenarioScreen>
  );
}
