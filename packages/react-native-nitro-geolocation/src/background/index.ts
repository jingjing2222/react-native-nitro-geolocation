import { NitroModules } from "react-native-nitro-modules";
import type { LocationError } from "../NitroGeolocation.nitro";
import type { NitroBackgroundLocation } from "./NitroBackgroundLocation.nitro";
import type {
  BackgroundActivityEventEnvelope,
  BackgroundEvent,
  BackgroundEventEnvelope,
  BackgroundGeofenceEventEnvelope,
  BackgroundHttpSyncEvent,
  BackgroundLocation,
  BackgroundSubscription,
  StoredBackgroundEvent,
  StoredBackgroundEventEnvelope
} from "./types";

const NativeBackgroundLocation =
  NitroModules.createHybridObject<NitroBackgroundLocation>(
    "NitroBackgroundLocation"
  );

function narrowBackgroundEvent(
  event: BackgroundEventEnvelope
): BackgroundEvent {
  switch (event.type) {
    case "location":
      return { ...event, type: "location", location: event.location! };
    case "geofence":
      return { ...event, type: "geofence", geofence: event.geofence! };
    case "activity":
      return { ...event, type: "activity", activity: event.activity! };
    case "providerChange":
      return {
        ...event,
        type: "providerChange",
        providerStatus: event.providerStatus!
      };
    case "httpSync":
      return { ...event, type: "httpSync", result: event.result! };
    case "error":
      return { ...event, type: "error", error: event.error! };
  }
}

export * from "./types";
export { BACKGROUND_LOCATION_TASK_NAME, registerBackgroundTask } from "./task";

export const checkBackgroundPermission =
  NativeBackgroundLocation.checkBackgroundPermission.bind(
    NativeBackgroundLocation
  );
export const requestBackgroundPermission =
  NativeBackgroundLocation.requestBackgroundPermission.bind(
    NativeBackgroundLocation
  );
export const openAppLocationSettings =
  NativeBackgroundLocation.openAppLocationSettings.bind(
    NativeBackgroundLocation
  );
export const configureBackgroundLocation =
  NativeBackgroundLocation.configureBackgroundLocation.bind(
    NativeBackgroundLocation
  );
export const getBackgroundConfiguration =
  NativeBackgroundLocation.getBackgroundConfiguration.bind(
    NativeBackgroundLocation
  );
export const startBackgroundLocation: NitroBackgroundLocation["startBackgroundLocation"] =
  (options) =>
    NativeBackgroundLocation.startBackgroundLocation(
      options ?? (undefined as any)
    );
export const stopBackgroundLocation =
  NativeBackgroundLocation.stopBackgroundLocation.bind(
    NativeBackgroundLocation
  );
export const resetBackgroundLocation =
  NativeBackgroundLocation.resetBackgroundLocation.bind(
    NativeBackgroundLocation
  );
export const getBackgroundLocationStatus =
  NativeBackgroundLocation.getBackgroundLocationStatus.bind(
    NativeBackgroundLocation
  );
export const getStoredBackgroundLocations: NitroBackgroundLocation["getStoredBackgroundLocations"] =
  (options) =>
    NativeBackgroundLocation.getStoredBackgroundLocations(
      options ?? (undefined as any)
    );
export const clearStoredBackgroundLocations: NitroBackgroundLocation["clearStoredBackgroundLocations"] =
  (ids) =>
    NativeBackgroundLocation.clearStoredBackgroundLocations(
      ids ?? (undefined as any)
    );
export const markStoredBackgroundLocationsDelivered =
  NativeBackgroundLocation.markStoredBackgroundLocationsDelivered.bind(
    NativeBackgroundLocation
  );
export async function getStoredBackgroundEvents(
  options?: Parameters<NitroBackgroundLocation["getStoredBackgroundEvents"]>[0]
): Promise<StoredBackgroundEvent[]> {
  const events = await NativeBackgroundLocation.getStoredBackgroundEvents(
    options ?? (undefined as any)
  );
  return events.map((event: StoredBackgroundEventEnvelope) => ({
    ...event,
    event: narrowBackgroundEvent(event.event)
  }));
}
export const clearStoredBackgroundEvents: NitroBackgroundLocation["clearStoredBackgroundEvents"] =
  (ids) =>
    NativeBackgroundLocation.clearStoredBackgroundEvents(
      ids ?? (undefined as any)
    );
export const markStoredBackgroundEventsDelivered =
  NativeBackgroundLocation.markStoredBackgroundEventsDelivered.bind(
    NativeBackgroundLocation
  );
export const addGeofences = NativeBackgroundLocation.addGeofences.bind(
  NativeBackgroundLocation
);
export const removeGeofences: NitroBackgroundLocation["removeGeofences"] = (
  identifiers
) =>
  NativeBackgroundLocation.removeGeofences(identifiers ?? (undefined as any));
export const getRegisteredGeofences =
  NativeBackgroundLocation.getRegisteredGeofences.bind(
    NativeBackgroundLocation
  );
export const startActivityRecognition: NitroBackgroundLocation["startActivityRecognition"] =
  (options) =>
    NativeBackgroundLocation.startActivityRecognition(
      options ?? (undefined as any)
    );
export const stopActivityRecognition =
  NativeBackgroundLocation.stopActivityRecognition.bind(
    NativeBackgroundLocation
  );
export const syncStoredLocations =
  NativeBackgroundLocation.syncStoredLocations.bind(NativeBackgroundLocation);

export function onBackgroundEvent(
  listener: (event: BackgroundEvent) => void
): BackgroundSubscription {
  const token = NativeBackgroundLocation.addBackgroundEventListener((event) => {
    listener(narrowBackgroundEvent(event));
  });
  return {
    remove: () => NativeBackgroundLocation.removeBackgroundEventListener(token)
  };
}

export function onBackgroundLocation(
  listener: (location: BackgroundLocation) => void
): BackgroundSubscription {
  const token =
    NativeBackgroundLocation.addBackgroundLocationListener(listener);
  return {
    remove: () =>
      NativeBackgroundLocation.removeBackgroundLocationListener(token)
  };
}

export function onBackgroundError(
  listener: (error: LocationError) => void
): BackgroundSubscription {
  const token = NativeBackgroundLocation.addBackgroundErrorListener(listener);
  return {
    remove: () => NativeBackgroundLocation.removeBackgroundErrorListener(token)
  };
}

export function onGeofence(
  listener: (event: BackgroundGeofenceEventEnvelope["geofence"]) => void
): BackgroundSubscription {
  return onBackgroundEvent((event) => {
    if (event.type === "geofence") {
      listener(event.geofence);
    }
  });
}

export function onActivityChange(
  listener: (activity: BackgroundActivityEventEnvelope["activity"]) => void
): BackgroundSubscription {
  return onBackgroundEvent((event) => {
    if (event.type === "activity") {
      listener(event.activity);
    }
  });
}

export function onHttpSync(
  listener: (result: BackgroundHttpSyncEvent["result"]) => void
): BackgroundSubscription {
  return onBackgroundEvent((event) => {
    if (event.type === "httpSync") {
      listener(event.result);
    }
  });
}
