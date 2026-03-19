import { useRozeniteDevToolsClient } from "@rozenite/plugin-bridge";
import type { DevtoolsRNEvents, Position } from "../shared/types";
import { useDevtoolsRN } from "./hooks/useDevtoolsRN";
import { useInitialPosition } from "./hooks/useInitialPosition";
import { useSetDevToolsEnabled } from "./hooks/useSetDevToolsEnabled";

interface UseGeolocationDevToolsOptions {
  initialPosition?: Position;
}

export const useGeolocationDevTools = (
  options?: UseGeolocationDevToolsOptions
) => {
  const client = useRozeniteDevToolsClient<DevtoolsRNEvents>({
    pluginId: "@react-native-nitro-geolocation/rozenite-plugin"
  });

  useSetDevToolsEnabled();
  useInitialPosition(options?.initialPosition);
  useDevtoolsRN({ client });
};
