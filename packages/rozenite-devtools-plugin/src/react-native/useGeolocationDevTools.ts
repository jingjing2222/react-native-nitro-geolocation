import { useRozeniteDevToolsClient } from "@rozenite/plugin-bridge";
import type { GeolocationPluginEvents, Position } from "../shared/types";
import { useSetDevToolsEnabled } from "./hooks/useSetDevToolsEnabled";

declare global {
  var __geolocationDevtools:
    | {
        position: Position | null;
      }
    | undefined;
  var __geolocationDevToolsEnabled: boolean | undefined;
}

function getDevtoolsState() {
  if (!globalThis.__geolocationDevtools) {
    globalThis.__geolocationDevtools = {
      position: null
    };
  }
  return globalThis.__geolocationDevtools;
}

export const useGeolocationDevTools = () => {
  const client = useRozeniteDevToolsClient<GeolocationPluginEvents>({
    pluginId: "@rozenite/react-native-nitro-geolocation-plugin"
  });

  useSetDevToolsEnabled();

  client?.onMessage("position", (data) => {
    console.log("Received position:", data);
    const devtools = getDevtoolsState();
    devtools.position = data;
  });
};
