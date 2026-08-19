import React, { useEffect, useRef, useState } from "react";
import {
  getProviderStatus,
  unwatch,
  watchProviderStatus
} from "react-native-nitro-geolocation";
import type { LocationProviderStatus } from "react-native-nitro-geolocation";
import {
  KeyValueBlock,
  ScenarioButton,
  ScenarioScreen,
  ScenarioSection
} from "./scenario";

const formatBoolean = (value: boolean | undefined) => {
  if (value === undefined) return "unknown";
  return value ? "enabled" : "disabled";
};

export default function ProviderStatusWatcherScreen() {
  const tokenRef = useRef<string | null>(null);
  const [status, setStatus] = useState<LocationProviderStatus | null>(null);
  const [manualStatus, setManualStatus] =
    useState<LocationProviderStatus | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const [listening, setListening] = useState(false);

  const stopListening = () => {
    if (tokenRef.current) {
      unwatch(tokenRef.current);
      tokenRef.current = null;
    }
    setListening(false);
  };

  const startListening = () => {
    if (tokenRef.current) return;

    const token = watchProviderStatus((nextStatus) => {
      setStatus(nextStatus);
      setEventCount((count) => count + 1);
    });
    tokenRef.current = token;
    setListening(true);
  };

  const refreshSnapshot = async () => {
    setManualStatus(await getProviderStatus());
  };

  useEffect(
    () => () => {
      if (tokenRef.current) unwatch(tokenRef.current);
    },
    []
  );

  return (
    <ScenarioScreen
      prefix="provider-status-watcher"
      title="Provider Status Watcher"
      subtitle="Observe readiness changes without opening settings"
    >
      <ScenarioSection
        index={1}
        title="Live Readiness"
        description="Start one listener for the initial provider snapshot and distinct device setting changes."
      >
        <KeyValueBlock
          testID="provider-status-watcher-status"
          rows={[
            {
              label: "Listener",
              value: listening ? "listening" : "stopped",
              testID: "provider-status-watcher-state"
            },
            {
              label: "Events",
              value: String(eventCount),
              testID: "provider-status-watcher-event-count"
            },
            {
              label: "Services",
              value: formatBoolean(status?.locationServicesEnabled),
              testID: "provider-status-watcher-services"
            },
            {
              label: "GPS",
              value: formatBoolean(status?.gpsAvailable),
              testID: "provider-status-watcher-gps"
            },
            {
              label: "Network",
              value: formatBoolean(status?.networkAvailable),
              testID: "provider-status-watcher-network"
            }
          ]}
        />
        <ScenarioButton
          title="Start Listening"
          onPress={startListening}
          disabled={listening}
          color="#1565C0"
          testID="provider-status-watcher-start-button"
        />
        <ScenarioButton
          title="Stop Listening"
          onPress={stopListening}
          disabled={!listening}
          color="#455A64"
          testID="provider-status-watcher-stop-button"
        />
      </ScenarioSection>

      <ScenarioSection
        index={2}
        title="On-Demand Check"
        description="Read the current provider state without restarting the listener or changing device settings."
        divided
      >
        <KeyValueBlock
          testID="provider-status-watcher-manual-status"
          rows={[
            {
              label: "Manual snapshot",
              value: formatBoolean(manualStatus?.locationServicesEnabled),
              testID: "provider-status-watcher-manual-services"
            }
          ]}
        />
        <ScenarioButton
          title="Refresh Snapshot"
          onPress={refreshSnapshot}
          color="#2E7D32"
          testID="provider-status-watcher-refresh-button"
        />
      </ScenarioSection>
    </ScenarioScreen>
  );
}
