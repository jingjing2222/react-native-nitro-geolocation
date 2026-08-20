import React, { useEffect, useRef, useState } from "react";
import { Platform, Text } from "react-native";
import {
  type BackgroundSubscription,
  type LocationLifecycleEvent,
  onLocationLifecycleChange,
  requestBackgroundPermission,
  startBackgroundLocation,
  stopBackgroundLocation
} from "react-native-nitro-geolocation/background";
import {
  ResultBlock,
  ScenarioButton,
  ScenarioScreen,
  ScenarioSection,
  createScenarioResults,
  getDisplayErrorMessage,
  useScenarioResults
} from "./scenario";

const PREFIX = "ios-location-lifecycle";
const initialResults = createScenarioResults([
  "subscription",
  "event",
  "removal",
  "tracking"
] as const);

export default function IOSLocationLifecycleScreen() {
  const { results, setResult } = useScenarioResults(initialResults);
  const subscriptionRef = useRef<BackgroundSubscription | null>(null);
  const mountedRef = useRef(true);
  const trackingOperationRef = useRef(0);
  const trackingStartInFlightRef = useRef(false);
  const trackingStartedRef = useRef(false);
  const [events, setEvents] = useState<LocationLifecycleEvent[]>([]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      trackingOperationRef.current += 1;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      if (trackingStartedRef.current || trackingStartInFlightRef.current) {
        trackingStartedRef.current = false;
        void stopBackgroundLocation().catch(() => undefined);
      }
    };
  }, []);

  const registerListener = () => {
    subscriptionRef.current?.remove();
    setEvents([]);
    setResult("event", initialResults.event);
    subscriptionRef.current = onLocationLifecycleChange((event) => {
      setEvents((current) => [event, ...current].slice(0, 10));
      setResult("event", {
        status: "passed",
        message: `Core Location reported ${event.state} at ${event.timestamp}.`
      });
    });
    setResult("subscription", {
      status: "passed",
      message:
        Platform.OS === "ios"
          ? "Listener active; waiting for real Core Location lifecycle callbacks."
          : "Listener active; Android emits no iOS Core Location lifecycle events."
    });
  };

  const removeListenerTwice = () => {
    const subscription = subscriptionRef.current;
    if (!subscription) {
      setResult("removal", {
        status: "failed",
        message: "Register the listener before removing it."
      });
      return;
    }

    subscription.remove();
    subscription.remove();
    subscriptionRef.current = null;
    setResult("removal", {
      status: "passed",
      message: "Called remove twice without an error."
    });
  };

  const startPauseEligibleTracking = async () => {
    if (trackingStartInFlightRef.current) {
      setResult("tracking", {
        status: "failed",
        message: "Wait for the current tracking start to finish first."
      });
      return;
    }
    trackingStartInFlightRef.current = true;
    const operation = trackingOperationRef.current + 1;
    trackingOperationRef.current = operation;
    setResult("tracking", {
      status: "running",
      message: "Requesting iOS background permission and starting real tracking"
    });
    try {
      if (Platform.OS !== "ios") {
        throw new Error("Core Location lifecycle callbacks are iOS-only.");
      }
      if (!subscriptionRef.current) {
        registerListener();
      }
      const permission = await requestBackgroundPermission();
      if (!mountedRef.current || operation !== trackingOperationRef.current) {
        return;
      }
      if (permission.background !== "granted") {
        throw new Error(
          `Background permission was not granted: ${permission.background}`
        );
      }
      await startBackgroundLocation({
        trackingMode: "continuous",
        persist: false,
        ios: {
          activityType: "fitness",
          pausesLocationUpdatesAutomatically: true,
          showsBackgroundLocationIndicator: false
        }
      });
      trackingStartedRef.current = true;
      if (!mountedRef.current || operation !== trackingOperationRef.current) {
        await stopBackgroundLocation();
        trackingStartedRef.current = false;
        return;
      }
      setResult("tracking", {
        status: "passed",
        message:
          "Tracking is running. Leave the device stationary and wait for iOS to pause naturally."
      });
    } catch (error) {
      if (mountedRef.current && operation === trackingOperationRef.current) {
        setResult("tracking", {
          status: "failed",
          message: getDisplayErrorMessage(error)
        });
      }
    } finally {
      trackingStartInFlightRef.current = false;
    }
  };

  const restartTrackingAfterPause = async () => {
    if (trackingStartInFlightRef.current) {
      setResult("tracking", {
        status: "failed",
        message: "Wait for the current tracking start to finish first."
      });
      return;
    }
    trackingStartInFlightRef.current = true;
    const operation = trackingOperationRef.current + 1;
    trackingOperationRef.current = operation;
    setResult("tracking", {
      status: "running",
      message: "Restarting location updates after an automatic pause"
    });
    try {
      if (Platform.OS !== "ios") {
        throw new Error("Core Location lifecycle callbacks are iOS-only.");
      }
      await startBackgroundLocation();
      trackingStartedRef.current = true;
      if (!mountedRef.current || operation !== trackingOperationRef.current) {
        await stopBackgroundLocation();
        trackingStartedRef.current = false;
        return;
      }
      setResult("tracking", {
        status: "passed",
        message:
          "Location updates restarted. iOS can now report the resumed callback."
      });
    } catch (error) {
      if (mountedRef.current && operation === trackingOperationRef.current) {
        setResult("tracking", {
          status: "failed",
          message: getDisplayErrorMessage(error)
        });
      }
    } finally {
      trackingStartInFlightRef.current = false;
    }
  };

  const stopTracking = async () => {
    const operation = trackingOperationRef.current + 1;
    trackingOperationRef.current = operation;
    try {
      await stopBackgroundLocation();
      trackingStartedRef.current = false;
      if (mountedRef.current && operation === trackingOperationRef.current) {
        setResult("tracking", {
          status: "passed",
          message: "Tracking stopped. No synthetic lifecycle event was emitted."
        });
      }
    } catch (error) {
      if (mountedRef.current && operation === trackingOperationRef.current) {
        setResult("tracking", {
          status: "failed",
          message: getDisplayErrorMessage(error)
        });
      }
    }
  };

  return (
    <ScenarioScreen
      prefix={PREFIX}
      title="iOS Location Lifecycle"
      subtitle="Real Core Location pause and app-triggered resume callbacks"
    >
      <ScenarioSection index={1} title="Listener">
        <ScenarioButton
          title="Register Listener"
          onPress={registerListener}
          testID={`${PREFIX}-register-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="subscription"
          label="Subscription"
          result={results.subscription}
        />
        <Text testID={`${PREFIX}-event-count`}>Events: {events.length}</Text>
        <ResultBlock
          prefix={PREFIX}
          id="event"
          label="Lifecycle event"
          result={results.event}
        />
      </ScenarioSection>

      <ScenarioSection index={2} title="Removal" divided>
        <ScenarioButton
          title="Remove Listener Twice"
          onPress={removeListenerTwice}
          color="#D84315"
          testID={`${PREFIX}-remove-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="removal"
          label="Removal"
          result={results.removal}
        />
      </ScenarioSection>

      <ScenarioSection index={3} title="Real Device Session" divided>
        <ScenarioButton
          title="Start Pause-Eligible Tracking"
          onPress={startPauseEligibleTracking}
          color="#2E7D32"
          testID={`${PREFIX}-start-tracking-button`}
        />
        <ScenarioButton
          title="Restart Tracking After Pause"
          onPress={restartTrackingAfterPause}
          color="#1565C0"
          testID={`${PREFIX}-restart-tracking-button`}
        />
        <ScenarioButton
          title="Stop Tracking"
          onPress={stopTracking}
          color="#616161"
          testID={`${PREFIX}-stop-tracking-button`}
        />
        <ResultBlock
          prefix={PREFIX}
          id="tracking"
          label="Tracking"
          result={results.tracking}
        />
      </ScenarioSection>
    </ScenarioScreen>
  );
}
