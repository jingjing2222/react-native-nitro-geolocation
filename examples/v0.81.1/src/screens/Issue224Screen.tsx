import { useRoute } from "@react-navigation/native";
import React, { useEffect, useRef, useState } from "react";
import { AppState, Text } from "react-native";
import {
  getPermissionDetails,
  requestPermission,
  setConfiguration,
  unwatch,
  watchPosition
} from "react-native-nitro-geolocation";
import { ScenarioButton, ScenarioScreen, ScenarioSection } from "./scenario";
import { runWithNativeGeolocation } from "./scenario/utils/nativeGeolocation";

/** Real modern-API watch; the external E2E collector freezes proof before resume. */
export default function Issue224Screen() {
  const route = useRoute();
  const port = (route.params as { port?: string } | undefined)?.port;
  const endpoint = /^\d+$/.test(port ?? "") ? `http://127.0.0.1:${port}` : null;
  const token = useRef<string | null>(null);
  const [permission, setPermission] = useState("not checked");
  const [foreground, setForeground] = useState(0);
  const [background, setBackground] = useState(0);
  const [result, setResult] = useState("not checked");
  const [error, setError] = useState("");

  const report = async (event: Record<string, unknown>) => {
    if (!endpoint)
      throw new Error("Open this screen through the issue-224 E2E runner");
    const response = await fetch(`${endpoint}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...event, sentAt: Date.now() })
    });
    if (!response.ok) throw new Error(`Collector HTTP ${response.status}`);
  };

  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (token.current) {
        void report({ type: "state", state }).catch((value) =>
          setError(String(value))
        );
      }
    });
    return () => {
      listener.remove();
      if (token.current) unwatch(token.current);
      setConfiguration({ enableBackgroundLocationUpdates: false });
    };
  }, [endpoint]);

  const start = async () => {
    try {
      if (token.current) unwatch(token.current);
      // Check before requesting: the test must exercise the already-granted branch.
      const before = await getPermissionDetails();
      if (before.status !== "granted" || before.scope !== "background") {
        throw new Error(
          `Always permission must be pre-granted: ${JSON.stringify(before)}`
        );
      }
      setConfiguration({
        authorizationLevel: "always",
        enableBackgroundLocationUpdates: true
      });
      const granted = await requestPermission();
      if (granted !== "granted") throw new Error(`Permission: ${granted}`);
      await report({ type: "permission", before, after: granted });
      setPermission("granted (pre-granted Always)");
      setForeground(0);
      setBackground(0);
      setResult("waiting for background route");
      token.current = await runWithNativeGeolocation(async () =>
        watchPosition(
          (position) => {
            const state = AppState.currentState;
            if (state === "active") setForeground((count) => count + 1);
            if (state === "background") setBackground((count) => count + 1);
            void report({
              type: "position",
              state,
              measuredAt: position.timestamp,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            }).catch((value) => setError(String(value)));
          },
          (value) => setError(value.message),
          { accuracy: { ios: "best" }, distanceFilter: 0, maximumAge: 0 }
        )
      );
    } catch (value) {
      setError(String(value));
    }
  };

  const validate = async () => {
    try {
      if (token.current) unwatch(token.current);
      token.current = null;
      const response = await fetch(`${endpoint}/result`);
      const verdict = await response.json();
      setResult(`${verdict.passed ? "passed" : "failed"}: ${verdict.message}`);
      setConfiguration({ enableBackgroundLocationUpdates: false });
    } catch (value) {
      setError(String(value));
    }
  };

  return (
    <ScenarioScreen
      prefix="issue-224"
      title="Issue 224: Background Watch"
      subtitle="Modern API · real CoreLocation · pre-granted Always"
    >
      <ScenarioSection index={1} title="Start in foreground">
        <ScenarioButton
          title="Start Watch"
          testID="issue-224-start"
          onPress={start}
        />
        <Text>Permission: {permission}</Text>
        <Text>Foreground callbacks: {foreground}</Text>
        <Text>Background callbacks: {background}</Text>
      </ScenarioSection>
      <ScenarioSection index={2} title="Return after background route">
        <Text>
          The runner checks two new coordinates while this app stays on the Home
          screen. Callbacks arriving after resume cannot pass.
        </Text>
        <ScenarioButton
          title="Validate Background Delivery"
          testID="issue-224-validate"
          onPress={validate}
        />
        <Text>Background delivery: {result}</Text>
        <Text>Error: {error || "none"}</Text>
      </ScenarioSection>
    </ScenarioScreen>
  );
}
