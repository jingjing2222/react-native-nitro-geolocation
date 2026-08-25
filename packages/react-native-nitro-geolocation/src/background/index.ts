import { NitroModules } from "react-native-nitro-modules";
import type { LocationError } from "../NitroGeolocation.nitro";
import type { NitroBackgroundLocation } from "./NitroBackgroundLocation.nitro";
import { createLocationLifecycleSubscription } from "./locationLifecycle";
import type {
  ActivityRecognitionOptions,
  BackgroundEvent,
  BackgroundEventEnvelope,
  BackgroundHttpSyncResult,
  BackgroundLocation,
  BackgroundLocationDiagnosis,
  BackgroundLocationOptions,
  BackgroundLocationStatus,
  BackgroundPermissionResult,
  BackgroundSubscription,
  DetectedActivity,
  GeofenceEvent,
  GeofenceRegion,
  GeofencingOptions,
  GetStoredBackgroundEventsOptions,
  GetStoredBackgroundLocationsOptions,
  LocationLifecycleEvent,
  StoredBackgroundEvent,
  StoredBackgroundEventEnvelope,
  StoredBackgroundLocation
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
    case "lifecycle":
      return {
        ...event,
        type: "lifecycle",
        lifecycle: event.lifecycle!
      };
    case "httpSync":
      return { ...event, type: "httpSync", result: event.result! };
    case "error":
      return { ...event, type: "error", error: event.error! };
  }
}

export * from "./types";
export { BACKGROUND_LOCATION_TASK_NAME, registerBackgroundTask } from "./task";

export function checkBackgroundPermission(): Promise<BackgroundPermissionResult> {
  return NativeBackgroundLocation.checkBackgroundPermission();
}

export function requestBackgroundPermission(): Promise<BackgroundPermissionResult> {
  return NativeBackgroundLocation.requestBackgroundPermission();
}

export function openAppLocationSettings(): Promise<void> {
  return NativeBackgroundLocation.openAppLocationSettings();
}

export function configureBackgroundLocation(
  options: BackgroundLocationOptions
): Promise<void> {
  return NativeBackgroundLocation.configureBackgroundLocation(options);
}

export function getBackgroundConfiguration(): Promise<
  BackgroundLocationOptions | undefined
> {
  return NativeBackgroundLocation.getBackgroundConfiguration();
}

export function startBackgroundLocation(
  options?: BackgroundLocationOptions
): Promise<void> {
  return NativeBackgroundLocation.startBackgroundLocation(options);
}

export function stopBackgroundLocation(): Promise<void> {
  return NativeBackgroundLocation.stopBackgroundLocation();
}

export function resetBackgroundLocation(): Promise<void> {
  return NativeBackgroundLocation.resetBackgroundLocation();
}

export function getBackgroundLocationStatus(): Promise<BackgroundLocationStatus> {
  return NativeBackgroundLocation.getBackgroundLocationStatus();
}

export function getStoredBackgroundLocations(
  options?: GetStoredBackgroundLocationsOptions
): Promise<StoredBackgroundLocation[]> {
  return NativeBackgroundLocation.getStoredBackgroundLocations(options);
}

export function clearStoredBackgroundLocations(ids?: string[]): Promise<void> {
  return NativeBackgroundLocation.clearStoredBackgroundLocations(ids);
}

export function markStoredBackgroundLocationsDelivered(
  ids: string[]
): Promise<void> {
  return NativeBackgroundLocation.markStoredBackgroundLocationsDelivered(ids);
}

export async function getStoredBackgroundEvents(
  options?: GetStoredBackgroundEventsOptions
): Promise<StoredBackgroundEvent[]> {
  const events =
    await NativeBackgroundLocation.getStoredBackgroundEvents(options);
  return events.map((event: StoredBackgroundEventEnvelope) => ({
    ...event,
    event: narrowBackgroundEvent(event.event)
  }));
}

export function clearStoredBackgroundEvents(ids?: string[]): Promise<void> {
  return NativeBackgroundLocation.clearStoredBackgroundEvents(ids);
}

export function markStoredBackgroundEventsDelivered(
  ids: string[]
): Promise<void> {
  return NativeBackgroundLocation.markStoredBackgroundEventsDelivered(ids);
}

export function addGeofences(
  regions: GeofenceRegion[],
  options?: GeofencingOptions
): Promise<void> {
  return NativeBackgroundLocation.addGeofences(regions, options);
}

export function removeGeofences(identifiers?: string[]): Promise<void> {
  return NativeBackgroundLocation.removeGeofences(identifiers);
}

export function getRegisteredGeofences(): Promise<GeofenceRegion[]> {
  return NativeBackgroundLocation.getRegisteredGeofences();
}

export function startActivityRecognition(
  options?: ActivityRecognitionOptions
): Promise<void> {
  return NativeBackgroundLocation.startActivityRecognition(options);
}

export function stopActivityRecognition(): Promise<void> {
  return NativeBackgroundLocation.stopActivityRecognition();
}

export function syncStoredLocations(): Promise<BackgroundHttpSyncResult> {
  return NativeBackgroundLocation.syncStoredLocations();
}

/**
 * Inspects the current background-location status and returns actionable reasons why location
 * delivery may not be working. Useful when the pipeline is silent: it surfaces the common causes
 * (a recorded native error, missing permissions, disabled location services, or a service that is
 * configured but not yet delivering) without the caller having to interpret the raw status object.
 */
export async function diagnoseBackgroundLocation(): Promise<BackgroundLocationDiagnosis> {
  const status = await getBackgroundLocationStatus();
  const issues: string[] = [];

  if (status.lastError) {
    issues.push(
      `Last native error: ${status.lastError.message} (code ${status.lastError.code}).`
    );
  }
  if (status.foregroundPermission !== "granted") {
    issues.push(
      `Foreground location permission is "${status.foregroundPermission}", not "granted".`
    );
  }
  if (status.backgroundPermission !== "granted") {
    issues.push(
      `Background location permission is "${status.backgroundPermission}", not "granted".`
    );
  }
  if (!status.locationServicesEnabled) {
    issues.push("Device location services are turned off.");
  }
  if (status.isConfigured && !status.isRunning) {
    issues.push(
      "Tracking is configured but not running — call startBackgroundLocation()."
    );
  }
  if (status.isRunning && status.state !== "running") {
    issues.push(
      `Service is started but not yet delivering (state: "${status.state}").`
    );
  }
  if (
    status.isRunning &&
    status.state === "running" &&
    status.storedLocationCount === 0
  ) {
    issues.push(
      "Running with no stored locations yet — the provider may have no fix, or distanceFilter/interval is filtering updates."
    );
  }
  if (status.android) {
    if (status.isRunning && !status.android.isForegroundServiceRunning) {
      issues.push("Android foreground service is not running.");
    }
    if (
      status.android.notificationPermission &&
      status.android.notificationPermission !== "granted"
    ) {
      issues.push(
        `Android notification permission is "${status.android.notificationPermission}" — the foreground-service notification may be suppressed.`
      );
    }
  }

  return { healthy: issues.length === 0, status, issues };
}

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

/**
 * Convenience filter for lifecycle events from the unified background stream.
 * After an automatic pause, the app must restart location updates before iOS
 * can report resume. Android keeps the subscription valid but emits no
 * Core Location lifecycle events.
 */
export function onLocationLifecycleChange(
  listener: (event: LocationLifecycleEvent) => void
): BackgroundSubscription {
  return createLocationLifecycleSubscription(
    NativeBackgroundLocation,
    listener
  );
}

export function onGeofence(
  listener: (event: GeofenceEvent) => void
): BackgroundSubscription {
  return onBackgroundEvent((event) => {
    if (event.type === "geofence") {
      listener(event.geofence);
    }
  });
}

export function onActivityChange(
  listener: (activity: DetectedActivity) => void
): BackgroundSubscription {
  return onBackgroundEvent((event) => {
    if (event.type === "activity") {
      listener(event.activity);
    }
  });
}

export function onHttpSync(
  listener: (result: BackgroundHttpSyncResult) => void
): BackgroundSubscription {
  return onBackgroundEvent((event) => {
    if (event.type === "httpSync") {
      listener(event.result);
    }
  });
}
