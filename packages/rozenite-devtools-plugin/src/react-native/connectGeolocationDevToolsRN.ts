import type {
  RozeniteDevToolsClient,
  Subscription
} from "@rozenite/plugin-bridge";
import { withMockMetadata } from "../shared/position";
import type { DevtoolsRNEvents, Position } from "../shared/types";

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

export function connectGeolocationDevToolsRN(
  client: RozeniteDevToolsClient<DevtoolsRNEvents>
) {
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
    getDevtoolsState().position = withMockMetadata(data);
  });

  return () => {
    for (const subscription of subscriptions) {
      subscription.remove();
    }
  };
}
