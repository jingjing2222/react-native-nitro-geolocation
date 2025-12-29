import { useRozeniteDevToolsClient } from "@rozenite/plugin-bridge";
import type { DevtoolsRNEvents, Position } from "../shared/types";
import { useDevtoolsRN } from "./hooks/useDevtoolsRN";
import { useInitialPosition } from "./hooks/useInitialPosition";
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

interface UseGeolocationDevToolsOptions {
  initialPosition?: Position;
}

export const useGeolocationDevTools = (
  options?: UseGeolocationDevToolsOptions
) => {
  const client = useRozeniteDevToolsClient<DevtoolsRNEvents>({
    pluginId: "@rozenite/react-native-nitro-geolocation-plugin"
  });

  useSetDevToolsEnabled();
  useInitialPosition(options?.initialPosition);
  useDevtoolsRN({ client });
};
