import React, { useEffect, useState } from "react";
import { Text } from "react-native";
import {
  LocationErrorCode,
  getCurrentPosition,
  getLocationErrorCodeName,
  getProviderStatus,
  hasServicesEnabled,
  requestLocationSettings
} from "react-native-nitro-geolocation";
import type {
  GeolocationResponse,
  LocationProviderStatus
} from "react-native-nitro-geolocation";
import {
  KeyValueBlock,
  PositionInfo,
  ScenarioButton,
  ScenarioScreen,
  ScenarioSection,
  captureLocationError,
  sharedStyles,
  usePermissionStatus
} from "./scenario";
import type { CapturedLocationError } from "./scenario";

const formatBoolean = (value: boolean | null | undefined) => {
  if (value === undefined || value === null) return "unknown";
  return value ? "enabled" : "disabled";
};

export default function ProviderSettingsScreen() {
  const { permissionStatus, refreshPermission, requestLocationPermission } =
    usePermissionStatus({ autoRefresh: false });
  const [servicesEnabled, setServicesEnabled] = useState<boolean | null>(null);
  const [providerStatus, setProviderStatus] =
    useState<LocationProviderStatus | null>(null);
  const [settingsStatus, setSettingsStatus] = useState("not requested");
  const [position, setPosition] = useState<GeolocationResponse | null>(null);
  const [error, setError] = useState<CapturedLocationError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const providerReady =
    servicesEnabled === true &&
    providerStatus?.locationServicesEnabled === true &&
    providerStatus.gpsAvailable === true &&
    providerStatus.networkAvailable === true;

  const refreshReadiness = async () => {
    const [permission, enabled, status] = await Promise.all([
      refreshPermission(),
      hasServicesEnabled(),
      getProviderStatus()
    ]);

    setServicesEnabled(enabled);
    setProviderStatus(status);
    return permission;
  };

  const checkDevice = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await refreshReadiness();
    } catch (err) {
      setError(captureLocationError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const prepareCheckIn = async () => {
    setIsLoading(true);
    setError(null);
    setSettingsStatus("checking");

    try {
      const permission = await requestLocationPermission();

      if (permission !== "granted") {
        setSettingsStatus("permission required");
        setError({
          code: LocationErrorCode.PERMISSION_DENIED,
          name: getLocationErrorCodeName(LocationErrorCode.PERMISSION_DENIED),
          message: "Location permission is required before check-in."
        });
        return;
      }

      const status = await requestLocationSettings({
        enableHighAccuracy: true,
        interval: 5000,
        fastestInterval: 1000,
        alwaysShow: true
      });

      setProviderStatus(status);
      setServicesEnabled(status.locationServicesEnabled);
      setSettingsStatus("ready");
    } catch (err) {
      setSettingsStatus("blocked");
      setError(captureLocationError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const confirmLocation = async () => {
    setIsLoading(true);
    setError(null);
    setPosition(null);

    try {
      const currentPosition = await getCurrentPosition({
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000
      });
      setPosition(currentPosition);
      await refreshReadiness();
    } catch (err) {
      setError(captureLocationError(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkDevice();
  }, []);

  return (
    <ScenarioScreen
      prefix="provider-settings"
      title="Accurate Check-In"
      subtitle="Android provider readiness contract"
    >
      <ScenarioSection
        index={1}
        title="Device Readiness"
        description="Confirm the device can provide the precise location needed before a field check-in."
      >
        <KeyValueBlock
          testID="provider-settings-status"
          rows={[
            { label: "Permission", value: permissionStatus },
            {
              label: "Services",
              value: formatBoolean(servicesEnabled),
              testID: "provider-settings-services"
            },
            {
              label: "GPS",
              value: formatBoolean(providerStatus?.gpsAvailable),
              testID: "provider-settings-gps"
            },
            {
              label: "Network",
              value: formatBoolean(providerStatus?.networkAvailable),
              testID: "provider-settings-network"
            },
            {
              label: "Google Accuracy",
              value: formatBoolean(
                providerStatus?.googleLocationAccuracyEnabled
              ),
              testID: "provider-settings-google-accuracy"
            }
          ]}
        />
        <Text
          style={sharedStyles.resultStatus}
          testID="provider-readiness-contract"
        >
          Provider readiness: {providerReady ? "ready" : "not ready"}
        </Text>
        <ScenarioButton
          title={isLoading ? "Checking..." : "Check Device"}
          onPress={checkDevice}
          disabled={isLoading}
          color="#1565C0"
        />
      </ScenarioSection>

      <ScenarioSection
        index={2}
        title="Prepare Check-In"
        description="Ask Android to enable the settings required for a high-accuracy check-in location."
        divided
      >
        <Text
          style={sharedStyles.resultStatus}
          testID="provider-settings-result"
        >
          Settings: {settingsStatus}
        </Text>
        <ScenarioButton
          title={isLoading ? "Preparing..." : "Prepare Check-In"}
          onPress={prepareCheckIn}
          disabled={isLoading}
          color="#2E7D32"
        />
      </ScenarioSection>

      <ScenarioSection
        index={3}
        title="Confirm Location"
        description="Capture the current precise position only after the device is ready."
        divided
      >
        <ScenarioButton
          title={isLoading ? "Locating..." : "Confirm Location"}
          onPress={confirmLocation}
          disabled={isLoading}
          color="#455A64"
        />
        <PositionInfo
          title="Ready to check in"
          position={position}
          testIDs={{
            container: "provider-position",
            title: "provider-check-in-ready",
            latitude: "provider-latitude",
            longitude: "provider-longitude",
            accuracy: "provider-accuracy",
            provider: "provider-used"
          }}
        />
      </ScenarioSection>

      {error && (
        <ScenarioSection title="Error" divided>
          <KeyValueBlock
            testID="provider-settings-error"
            rows={[
              { label: "Code", value: error.code },
              { label: "Name", value: error.name },
              { label: "Message", value: error.message }
            ]}
          />
        </ScenarioSection>
      )}
    </ScenarioScreen>
  );
}
