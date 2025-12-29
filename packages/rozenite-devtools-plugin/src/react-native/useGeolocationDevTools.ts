import { useRozeniteDevToolsClient } from "@rozenite/plugin-bridge";
import { useEffect, useMemo } from "react";
import type { GeolocationPluginEvents, Position } from "../shared/types";
import { useDevtoolsMessages } from "./hooks/useDevtoolsMessages";
import { useSetDevToolsEnabled } from "./hooks/useSetDevToolsEnabled";

declare global {
  var __geolocationDevtools:
    | {
        position: Position | null;
        initialPosition: Position | null;
      }
    | undefined;
  var __geolocationDevToolsEnabled: boolean | undefined;
}

function getDevtoolsState() {
  if (!globalThis.__geolocationDevtools) {
    globalThis.__geolocationDevtools = {
      position: null,
      initialPosition: null
    };
  }
  return globalThis.__geolocationDevtools;
}

interface UseGeolocationDevToolsOptions {
  initialPosition?: Position;
}

export const useGeolocationDevTools = (
  options?: UseGeolocationDevToolsOptions
) => {
  const client = useRozeniteDevToolsClient<GeolocationPluginEvents>({
    pluginId: "@rozenite/react-native-nitro-geolocation-plugin"
  });

  useSetDevToolsEnabled();

  // Store initial position in global state
  useEffect(() => {
    if (options?.initialPosition) {
      const devtools = getDevtoolsState();
      devtools.initialPosition = options.initialPosition;
      // Only set position if not already set
      if (!devtools.position) {
        devtools.position = options.initialPosition;
      }
    }
  }, [options?.initialPosition]);

  // Setup message handlers
  const messageHandlers = useMemo(
    () => ({
      ready: () => {
        console.log("[RN App] Devtools ready, sending initial position");
        const devtools = getDevtoolsState();
        if (devtools.initialPosition && client) {
          client.send("initialPosition", devtools.initialPosition);
        }
      },
      position: (data: Position) => {
        console.log("[RN App] Received position update:", data);
        const devtools = getDevtoolsState();
        devtools.position = data;
      }
    }),
    [client]
  );

  useDevtoolsMessages(client, messageHandlers);
};
