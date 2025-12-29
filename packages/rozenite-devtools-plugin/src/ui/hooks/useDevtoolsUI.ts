import type {
  RozeniteDevToolsClient,
  Subscription
} from "@rozenite/plugin-bridge";
import { useEffect, useRef } from "react";
import type { DevtoolsUIEvents, Position } from "../../shared/types";

interface UseDevtoolsUIOptions {
  client: RozeniteDevToolsClient<DevtoolsUIEvents> | null;
  onInitialPosition: (position: Position) => void;
}

export function useDevtoolsUI({
  client,
  onInitialPosition
}: UseDevtoolsUIOptions) {
  const onInitialPositionRef = useRef(onInitialPosition);

  useEffect(() => {
    onInitialPositionRef.current = onInitialPosition;
  }, [onInitialPosition]);

  // Send "ready" signal when client connects
  useEffect(() => {
    if (client) {
      client.send("ready", null);
    }
  }, [client]);

  // Listen for initialPosition message
  useEffect(() => {
    if (!client) return;

    const subscriptions: Subscription[] = [];

    const subscribe = <T extends keyof DevtoolsUIEvents>(
      messageType: T,
      handler: (data: DevtoolsUIEvents[T]) => void
    ) => {
      const subscription = client.onMessage(messageType, handler);
      if (subscription) subscriptions.push(subscription);
    };

    subscribe("initialPosition", (data) => {
      onInitialPositionRef.current(data);
    });

    return () => {
      for (const subscription of subscriptions) {
        subscription.remove();
      }
    };
  }, [client]);
}
