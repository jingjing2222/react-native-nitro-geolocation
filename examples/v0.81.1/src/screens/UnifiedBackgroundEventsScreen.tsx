import React, { useEffect, useRef, useState } from "react";
import { getProviderStatus } from "react-native-nitro-geolocation";
import type { LocationProviderStatus } from "react-native-nitro-geolocation";
import {
  type BackgroundSubscription,
  onBackgroundEvent
} from "react-native-nitro-geolocation/background";
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

export default function UnifiedBackgroundEventsScreen() {
  const subscriptionRef = useRef<BackgroundSubscription | null>(null);
  const [listening, setListening] = useState(false);
  const [eventCount, setEventCount] = useState(0);
  const [providerCount, setProviderCount] = useState(0);
  const [lifecycleCount, setLifecycleCount] = useState(0);
  const [status, setStatus] = useState<LocationProviderStatus | null>(null);
  const [manualStatus, setManualStatus] =
    useState<LocationProviderStatus | null>(null);
  const [lastLifecycle, setLastLifecycle] = useState("none");

  const stopListening = () => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    setListening(false);
  };

  const startListening = () => {
    if (subscriptionRef.current) return;
    subscriptionRef.current = onBackgroundEvent((event) => {
      setEventCount((count) => count + 1);
      if (event.type === "providerChange") {
        setProviderCount((count) => count + 1);
        setStatus(event.providerStatus);
      }
      if (event.type === "lifecycle") {
        setLifecycleCount((count) => count + 1);
        setLastLifecycle(event.lifecycle.state);
      }
    });
    setListening(true);
  };

  const refreshSnapshot = async () => {
    setManualStatus(await getProviderStatus());
  };

  useEffect(() => () => subscriptionRef.current?.remove(), []);

  return (
    <ScenarioScreen
      prefix="unified-background-events"
      title="Unified Background Events"
      subtitle="Provider and lifecycle changes use the same event subscription"
    >
      <ScenarioSection
        index={1}
        title="One Subscription"
        description="Observe real provider changes and Core Location lifecycle callbacks without parallel listener APIs."
      >
        <KeyValueBlock
          testID="unified-background-events-status"
          rows={[
            {
              label: "Listener",
              value: listening ? "listening" : "stopped"
            },
            { label: "Events", value: String(eventCount) },
            { label: "Provider events", value: String(providerCount) },
            { label: "Lifecycle events", value: String(lifecycleCount) },
            {
              label: "Services",
              value: formatBoolean(status?.locationServicesEnabled)
            },
            { label: "Last lifecycle", value: lastLifecycle }
          ]}
        />
        <ScenarioButton
          title="Start Listening"
          onPress={startListening}
          disabled={listening}
          color="#1565C0"
          testID="unified-background-events-start-button"
        />
        <ScenarioButton
          title="Stop Listening"
          onPress={stopListening}
          disabled={!listening}
          color="#455A64"
          testID="unified-background-events-stop-button"
        />
      </ScenarioSection>

      <ScenarioSection
        index={2}
        title="Removal Edge Case"
        description="After removal, a direct snapshot may change while the unified event counters remain frozen."
        divided
      >
        <KeyValueBlock
          testID="unified-background-events-manual-status"
          rows={[
            {
              label: "Manual snapshot",
              value: formatBoolean(manualStatus?.locationServicesEnabled)
            }
          ]}
        />
        <ScenarioButton
          title="Refresh Snapshot"
          onPress={refreshSnapshot}
          color="#2E7D32"
          testID="unified-background-events-refresh-button"
        />
      </ScenarioSection>
    </ScenarioScreen>
  );
}
