import type {
  RozeniteDevToolsClient,
  Subscription
} from "@rozenite/plugin-bridge";
import { useEffect } from "react";
import type { DevtoolsRNEvents, Position } from "../../shared/types";

declare global {
  var __geolocationDevtools:
    | {
        position: Position | null;
        initialPosition: Position | null;
      }
    | undefined;
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

interface UseDevtoolsRNOptions {
  client: RozeniteDevToolsClient<DevtoolsRNEvents> | null;
}

export function useDevtoolsRN({ client }: UseDevtoolsRNOptions) {
  useEffect(() => {
    if (!client) return;

    const subscriptions: Subscription[] = [];

    const subscribe = <T extends keyof DevtoolsRNEvents>(
      messageType: T,
      handler: (data: DevtoolsRNEvents[T]) => void
    ) => {
      const subscription = client.onMessage(messageType, handler);
      if (subscription) subscriptions.push(subscription);
    };

    subscribe("ready", () => {
      const devtools = getDevtoolsState();
      if (devtools.initialPosition) {
        client.send("initialPosition", devtools.initialPosition);
      }
    });

    subscribe("position", (data) => {
      const devtools = getDevtoolsState();
      devtools.position = data;
    });

    return () => {
      for (const subscription of subscriptions) {
        subscription.remove();
      }
    };
  }, [client]);
}
