import { useRozeniteDevToolsClient } from "@rozenite/plugin-bridge";
import type { GeolocationPluginEvents } from "../shared/types";

export const useGeolocationDevTools = () => {
  const client = useRozeniteDevToolsClient<GeolocationPluginEvents>({
    pluginId: "@rozenite/react-native-nitro-geolocation-plugin"
  });

  client?.onMessage("helloworld", (data) => {
    console.log("Received message:", data.message);
  });
};
