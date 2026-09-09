import React, { useEffect, useRef, useState } from "react";
import {
  type BackgroundSubscription,
  getBackgroundLocationStatus,
  getStoredBackgroundEvents,
  onBackgroundEvent,
  resetBackgroundLocation,
  startBackgroundLocation
} from "react-native-nitro-geolocation/background";
import { backgroundE2EOptions } from "./backgroundE2EOptions";
import { KeyValueBlock, ScenarioButton, ScenarioSection } from "./scenario";

export default function NotificationActionE2EScenario() {
  const subscription = useRef<BackgroundSubscription | null>(null);
  const received = useRef<{ id: string; actionId: string }[]>([]);
  const [liveActions, setLiveActions] = useState("none");
  const [proof, setProof] = useState("not started");
  const [nativeStop, setNativeStop] = useState("not checked");

  useEffect(() => () => subscription.current?.remove(), []);

  const prepare = async () => {
    setProof("starting");
    setNativeStop("not checked");
    setLiveActions("none");
    subscription.current?.remove();
    received.current = [];
    try {
      await resetBackgroundLocation();
      subscription.current = onBackgroundEvent((event) => {
        if (event.type !== "notificationAction") return;
        received.current.push({
          id: event.id,
          actionId: event.notificationAction.actionId
        });
        setLiveActions(
          received.current.map((value) => value.actionId).join(",")
        );
      });
      await startBackgroundLocation({
        ...backgroundE2EOptions,
        trackingMode: "continuous",
        maxStoredEvents: 100,
        startOnBoot: false,
        activityRecognition: { enabled: false },
        android: {
          foregroundService: {
            ...backgroundE2EOptions.android.foregroundService,
            actions: [
              { id: "checkpoint", title: "Mark E2E checkpoint" },
              { id: "pause", title: "Pause E2E action" }
            ]
          }
        }
      });
      setProof("ready");
    } catch (error) {
      subscription.current?.remove();
      subscription.current = null;
      setProof(`failed: ${String(error)}`);
    }
  };

  const verify = async () => {
    try {
      const stored = await getStoredBackgroundEvents({
        types: ["notificationAction"],
        includeDelivered: true
      });
      const status = await getBackgroundLocationStatus();
      const actions = received.current;
      if (
        actions.map((value) => value.actionId).join(",") !==
          "checkpoint,pause" ||
        stored.length !== actions.length ||
        !actions.every((action) =>
          stored.some(
            ({ event }) =>
              event.id === action.id &&
              event.type === "notificationAction" &&
              event.notificationAction.actionId === action.actionId
          )
        ) ||
        !status.isRunning ||
        status.android?.isForegroundServiceRunning !== true
      ) {
        throw new Error(
          "Expected both live/stored action payloads and active tracking."
        );
      }
      setProof(
        "passed: live and stored payloads match; tracking remains active"
      );
    } catch (error) {
      setProof(`failed: ${String(error)}`);
    }
  };

  const verifyNativeStop = async () => {
    try {
      const status = await getBackgroundLocationStatus();
      if (status.isRunning || status.android?.isForegroundServiceRunning) {
        throw new Error("Tap Stop E2E tracking in the notification first.");
      }
      subscription.current?.remove();
      subscription.current = null;
      setNativeStop("passed");
    } catch (error) {
      setNativeStop(`failed: ${String(error)}`);
    }
  };

  return (
    <ScenarioSection
      index={4}
      title="Android Notification Actions"
      description="Start tracking, tap both custom notification buttons, then use the native Stop button."
      divided
    >
      <KeyValueBlock
        testID="notification-action-status"
        rows={[
          { label: "Live actions", value: liveActions },
          { label: "Notification proof", value: proof },
          { label: "Native notification stop", value: nativeStop }
        ]}
      />
      <ScenarioButton
        title="Prepare Notification Actions"
        onPress={prepare}
        testID="notification-action-prepare"
      />
      <ScenarioButton
        title="Verify Action Delivery"
        onPress={verify}
        testID="notification-action-verify"
      />
      <ScenarioButton
        title="Verify Native Notification Stop"
        onPress={verifyNativeStop}
        testID="notification-action-verify-stop"
      />
    </ScenarioSection>
  );
}
