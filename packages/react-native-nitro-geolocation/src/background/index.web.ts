import type { LocationError } from "../NitroGeolocation.nitro";
import type {
  ActivityRecognitionOptions,
  BackgroundEvent,
  BackgroundHttpSyncResult,
  BackgroundLocation,
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
  StoredBackgroundEvent,
  StoredBackgroundLocation
} from "./types";

export * from "./types";

export const BACKGROUND_LOCATION_TASK_NAME = "NitroBackgroundLocationTask";

const unsupported = (): Error =>
  new Error("Background location is not available in the browser.");

const rejectUnsupported = <T>(): Promise<T> => Promise.reject(unsupported());

export function registerBackgroundTask(): void {
  throw unsupported();
}

export const checkBackgroundPermission =
  (): Promise<BackgroundPermissionResult> => rejectUnsupported();
export const requestBackgroundPermission =
  (): Promise<BackgroundPermissionResult> => rejectUnsupported();
export const openAppLocationSettings = (): Promise<void> => rejectUnsupported();
export const configureBackgroundLocation = (
  _options: BackgroundLocationOptions
): Promise<void> => rejectUnsupported();
export const getBackgroundConfiguration = (): Promise<
  BackgroundLocationOptions | undefined
> => rejectUnsupported();
export const startBackgroundLocation = (
  _options?: BackgroundLocationOptions
): Promise<void> => rejectUnsupported();
export const stopBackgroundLocation = (): Promise<void> => rejectUnsupported();
export const resetBackgroundLocation = (): Promise<void> => rejectUnsupported();
export const getBackgroundLocationStatus =
  (): Promise<BackgroundLocationStatus> => rejectUnsupported();
export const getStoredBackgroundLocations = (
  _options?: GetStoredBackgroundLocationsOptions
): Promise<StoredBackgroundLocation[]> => rejectUnsupported();
export const clearStoredBackgroundLocations = (
  _ids?: string[]
): Promise<void> => rejectUnsupported();
export const markStoredBackgroundLocationsDelivered = (
  _ids: string[]
): Promise<void> => rejectUnsupported();
export const getStoredBackgroundEvents = (
  _options?: GetStoredBackgroundEventsOptions
): Promise<StoredBackgroundEvent[]> => rejectUnsupported();
export const clearStoredBackgroundEvents = (_ids?: string[]): Promise<void> =>
  rejectUnsupported();
export const markStoredBackgroundEventsDelivered = (
  _ids: string[]
): Promise<void> => rejectUnsupported();
export const addGeofences = (
  _regions: GeofenceRegion[],
  _options?: GeofencingOptions
): Promise<void> => rejectUnsupported();
export const removeGeofences = (_identifiers?: string[]): Promise<void> =>
  rejectUnsupported();
export const getRegisteredGeofences = (): Promise<GeofenceRegion[]> =>
  rejectUnsupported();
export const startActivityRecognition = (
  _options?: ActivityRecognitionOptions
): Promise<void> => rejectUnsupported();
export const stopActivityRecognition = (): Promise<void> => rejectUnsupported();
export const syncStoredLocations = (): Promise<BackgroundHttpSyncResult> =>
  rejectUnsupported();

const noopSubscription = (): BackgroundSubscription => ({ remove() {} });

export function onBackgroundEvent(
  _listener: (event: BackgroundEvent) => void
): BackgroundSubscription {
  return noopSubscription();
}

export function onBackgroundLocation(
  _listener: (location: BackgroundLocation) => void
): BackgroundSubscription {
  return noopSubscription();
}

export function onBackgroundError(
  _listener: (error: LocationError) => void
): BackgroundSubscription {
  return noopSubscription();
}

export function onGeofence(
  _listener: (event: GeofenceEvent) => void
): BackgroundSubscription {
  return noopSubscription();
}

export function onActivityChange(
  _listener: (activity: DetectedActivity) => void
): BackgroundSubscription {
  return noopSubscription();
}

export function onHttpSync(
  _listener: (result: BackgroundHttpSyncResult) => void
): BackgroundSubscription {
  return noopSubscription();
}
