import type {
  RozeniteDevToolsClient,
  Subscription
} from "@rozenite/plugin-bridge";
import { useEffect } from "react";
import type { GeolocationPluginEvents, Position } from "../../shared/types";

// Explicit message types (not using keyof to avoid index signature)
type MessageType = "initialPosition" | "position" | "ready";

interface MessageHandlers {
  initialPosition?: (data: Position) => void;
  position?: (data: Position) => void;
  ready?: (data: null) => void;
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

    // Single onMessage handler that routes to specific handlers based on type
    const handleMessage = (type: MessageType, data: unknown) => {
      console.log(`[Devtools] Received message: ${type}`, data);

      switch (type) {
        case "initialPosition":
          handlers.initialPosition?.(data as Position);
          break;
        case "position":
          handlers.position?.(data as Position);
          break;
        case "ready":
          handlers.ready?.(data as null);
          break;
        default:
          assertNever(type);
      }
    };

    // Register single message listener for all types
    const subscriptions: Subscription[] = [];

    for (const type of Object.keys(handlers) as MessageType[]) {
      const subscription = client.onMessage(type, (data) =>
        handleMessage(type, data)
      );
      if (subscription) subscriptions.push(subscription);
    }

    // Cleanup all subscriptions
    return () => {
      for (const subscription of subscriptions) {
        subscription.remove();
      }
    };
  }, [client, handlers]);
}
