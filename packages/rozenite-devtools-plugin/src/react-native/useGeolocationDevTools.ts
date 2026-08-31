import { useRozeniteDevToolsClient } from "@rozenite/plugin-bridge";
import { useMemo } from "react";
import { createPosition } from "../shared/presets";
import type { DevtoolsRNEvents, Position } from "../shared/types";
import { useDevtoolsRN } from "./hooks/useDevtoolsRN";
import { useInitialPosition } from "./hooks/useInitialPosition";
import { useSetDevToolsEnabled } from "./hooks/useSetDevToolsEnabled";

declare const __DEV__: boolean;

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

export function createInitialPosition(initialPosition?: Position): Position {
  return initialPosition ?? createPosition("Seoul, South Korea");
}

const isReactNativeDev = () =>
  typeof __DEV__ !== "undefined" && __DEV__ === true;

export const useGeolocationDevTools = (
  options?: UseGeolocationDevToolsOptions
) => {
  if (!isReactNativeDev()) {
    return;
  }

  const client = useRozeniteDevToolsClient<DevtoolsRNEvents>({
    pluginId: "@react-native-nitro-geolocation/rozenite-plugin"
  });
  const defaultPosition = useMemo(
    () => createInitialPosition(options?.initialPosition),
    [options?.initialPosition]
  );

  useSetDevToolsEnabled();
  useInitialPosition(defaultPosition);
  useDevtoolsRN({ client });
};
