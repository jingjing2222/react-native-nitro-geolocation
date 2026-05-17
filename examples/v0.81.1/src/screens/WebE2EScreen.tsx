import { useRoute } from "@react-navigation/native";
import React, { useMemo, useState } from "react";
import { Platform, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";
import { ScenarioButton, ScenarioScreen, sharedStyles } from "./scenario";

const DEFAULT_WEB_E2E_URL = Platform.select({
  android: "http://localhost:4173",
  ios: "http://127.0.0.1:4173",
  default: "http://127.0.0.1:4173"
});

export default function WebE2EScreen() {
  const route = useRoute();
  const [reloadKey, setReloadKey] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState("idle");
  const uri = useMemo(() => DEFAULT_WEB_E2E_URL ?? "", []);
  const autorun =
    typeof (route.params as { autorun?: unknown } | undefined)?.autorun ===
    "string"
      ? (route.params as { autorun: string }).autorun
      : undefined;
  const sourceUri = autorun
    ? `${uri}?autorun=${encodeURIComponent(autorun)}&reload=${reloadKey}`
    : `${uri}?reload=${reloadKey}`;

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as {
        id?: string;
        raw?: {
          phase?: unknown;
        };
        status?: string;
      };
      if (message.id && message.status) {
        const phase =
          typeof message.raw?.phase === "string"
            ? `: ${message.raw.phase}`
            : "";
        setLastEvent(`${message.id}: ${message.status}${phase}`);
      }
    } catch {
      setLastEvent("web-e2e: invalid-message");
    }
  };

  return (
    <ScenarioScreen
      prefix="web-e2e"
      title="Web E2E"
      subtitle="Loads examples/web-e2e through react-native-webview"
      contentContainerStyle={webE2EStyles.content}
    >
      <View style={webE2EStyles.bar}>
        <Text style={webE2EStyles.url} testID="web-e2e-url">
          {sourceUri}
        </Text>
        <ScenarioButton
          title="Reload"
          onPress={() => {
            setLoadError(null);
            setReloadKey((current) => current + 1);
          }}
          color="#2196F3"
          containerStyle={webE2EStyles.reloadButton}
        />
      </View>
      {loadError ? (
        <View style={sharedStyles.errorContainer} testID="web-e2e-load-error">
          <Text style={sharedStyles.errorText}>{loadError}</Text>
        </View>
      ) : null}
      <View style={webE2EStyles.nativeStatus}>
        <Text style={webE2EStyles.nativeStatusText} testID="web-e2e-last-event">
          {lastEvent}
        </Text>
      </View>
      <View style={webE2EStyles.webViewFrame}>
        <WebView
          key={reloadKey}
          testID="web-e2e-webview"
          source={{ uri: sourceUri }}
          originWhitelist={["http://*", "https://*"]}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          geolocationEnabled={true}
          setSupportMultipleWindows={false}
          onLoadStart={() => setLoadError(null)}
          onError={(event) => {
            setLoadError(event.nativeEvent.description);
          }}
          onHttpError={(event) => {
            setLoadError(`HTTP ${event.nativeEvent.statusCode}`);
          }}
          onMessage={handleMessage}
          style={webE2EStyles.webView}
        />
      </View>
    </ScenarioScreen>
  );
}

const webE2EStyles = {
  content: {
    flexGrow: 1
  },
  bar: {
    alignItems: "center" as const,
    backgroundColor: "#FFFFFF",
    borderBottomColor: "#E5E7EB",
    borderBottomWidth: 1,
    flexDirection: "row" as const,
    gap: 8,
    padding: 12
  },
  url: {
    color: "#374151",
    flex: 1,
    fontSize: 13
  },
  reloadButton: {
    minWidth: 96
  },
  nativeStatus: {
    backgroundColor: "#ECFDF5",
    borderBottomColor: "#10B981",
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  nativeStatusText: {
    color: "#065F46",
    fontSize: 14,
    fontWeight: "700" as const
  },
  webViewFrame: {
    flex: 1,
    minHeight: 640
  },
  webView: {
    backgroundColor: "#F7F9FC",
    flex: 1
  }
};
