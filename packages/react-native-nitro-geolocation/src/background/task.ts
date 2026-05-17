import { AppRegistry } from "react-native";
import type { BackgroundEvent, BackgroundTaskHandler } from "./types";

export const BACKGROUND_LOCATION_TASK_NAME = "NitroBackgroundLocationTask";

export function registerBackgroundTask(handler: BackgroundTaskHandler): void {
  AppRegistry.registerHeadlessTask(
    BACKGROUND_LOCATION_TASK_NAME,
    () => async (event: BackgroundEvent) => {
      await handler(event);
    }
  );
}
