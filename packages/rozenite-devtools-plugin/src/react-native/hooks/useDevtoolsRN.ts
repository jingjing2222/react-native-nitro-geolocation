import type { RozeniteDevToolsClient } from "@rozenite/plugin-bridge";
import { useEffect } from "react";
import type { DevtoolsRNEvents } from "../../shared/types";
import { connectGeolocationDevToolsRN } from "../connectGeolocationDevToolsRN";

interface UseDevtoolsRNOptions {
  client: RozeniteDevToolsClient<DevtoolsRNEvents> | null;
}

export function useDevtoolsRN({ client }: UseDevtoolsRNOptions) {
  useEffect(() => {
    if (!client) return;
    return connectGeolocationDevToolsRN(client);
  }, [client]);
}
