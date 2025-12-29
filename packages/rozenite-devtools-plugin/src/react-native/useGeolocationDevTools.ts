import { useRozeniteDevToolsClient } from "@rozenite/plugin-bridge";
import type { GeolocationPluginEvents, Position } from "../shared/types";
import { useSetDevToolsEnabled } from "./hooks/useSetDevToolsEnabled";

interface Devtools {
  position: Position;
}

export const useGeolocationDevTools = (devtools: Devtools) => {
  const client = useRozeniteDevToolsClient<GeolocationPluginEvents>({
    pluginId: "@rozenite/react-native-nitro-geolocation-plugin"
  });

  useSetDevToolsEnabled();

  client?.onMessage("position", (data) => {
    console.log("Received position:", data.accuracy);
    devtools.position = data;
  });
};
