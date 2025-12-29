import type {
  RozeniteDevToolsClient,
  Subscription
} from "@rozenite/plugin-bridge";
import { useEffect } from "react";
import type { GeolocationPluginEvents, Position } from "../../shared/types";

type MessageType = "ready" | "position";

interface MessageHandlers {
  ready?: () => void;
  position?: (data: Position) => void;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled message type: ${String(value)}`);
}

export function useDevtoolsMessages(
  client: RozeniteDevToolsClient<GeolocationPluginEvents> | null,
  handlers: MessageHandlers
) {
  useEffect(() => {
    if (!client) return;

    const handleMessage = (type: MessageType, data: unknown) => {
      console.log(`[RN App] Received message: ${type}`, data);

      switch (type) {
        case "ready":
          handlers.ready?.();
          break;
        case "position":
          handlers.position?.(data as Position);
          break;
        default:
          assertNever(type);
      }
    };

    const subscriptions: Subscription[] = [];

    for (const type of Object.keys(handlers) as MessageType[]) {
      const subscription = client.onMessage(type, (data) =>
        handleMessage(type, data)
      );
      if (subscription) subscriptions.push(subscription);
    }

    return () => {
      for (const subscription of subscriptions) {
        subscription.remove();
      }
    };
  }, [client, handlers]);
}
