import type {
  AndroidGranularity,
  LocationAccuracyOptions
} from "../publicTypes";
import type {
  ActivityRecognitionOptions,
  AndroidForegroundServiceOptions,
  BackgroundErrorEvent,
  BackgroundEventBase,
  BackgroundHttpSyncEvent,
  BackgroundHttpSyncOptions,
  BackgroundLifecycleEvent,
  BackgroundLocationEvent,
  BackgroundProviderChangeEvent,
  BackgroundTrackingMode,
  DetectedActivity,
  GeofenceEvent,
  GeofencingOptions,
  IOSBackgroundLocationOptions
} from "./types";

// Keep the `/background` entry point self-contained: consumers should be able
// to import every named type referenced by its public options, status, and
// event contracts without reaching through the package root.
export type {
  AccuracyAuthorization,
  AndroidAccuracyPreset,
  AndroidGranularity,
  IOSAccuracyPreset,
  LocationAccuracyOptions,
  LocationProviderStatus,
  LocationProviderUsed,
  PermissionStatus
} from "../publicTypes";
export type {
  GeolocationCoordinates,
  GeolocationResponse,
  NullableDouble
} from "../types";
export type { LocationError, LocationErrorCode } from "../utils/errors";

export type {
  ActivityRecognitionOptions,
  AndroidBackgroundLocationStatus,
  AndroidForegroundServiceOptions,
  BackgroundErrorEvent,
  BackgroundEventBase,
  BackgroundEventType,
  BackgroundHttpMethod,
  BackgroundHttpSyncEvent,
  BackgroundHttpSyncOptions,
  BackgroundHttpSyncResult,
  BackgroundLifecycleEvent,
  BackgroundLocation,
  BackgroundLocationDiagnosis,
  BackgroundLocationEvent,
  BackgroundLocationSource,
  BackgroundLocationState,
  BackgroundLocationStatus,
  BackgroundPermissionResult,
  BackgroundPermissionStatus,
  BackgroundProviderChangeEvent,
  BackgroundSubscription,
  BackgroundTrackingMode,
  BatterySnapshot,
  DetectedActivity,
  DetectedActivityType,
  GeofenceEvent,
  GeofenceRegion,
  GeofenceTransition,
  GeofencingOptions,
  GetStoredBackgroundEventsOptions,
  GetStoredBackgroundLocationsOptions,
  IOSBackgroundActivityType,
  IOSBackgroundLocationOptions,
  IOSBackgroundLocationStatus,
  LocationLifecycleEvent,
  LocationLifecycleState,
  StoredBackgroundLocation
} from "./types";

/** Android provider selection exposed by the public background API. */
export type AndroidBackgroundProvider = "auto" | "playServices" | "android";

export interface AndroidBackgroundLocationOptions {
  locationProvider?: AndroidBackgroundProvider;
  foregroundService: AndroidForegroundServiceOptions;
  requestNotificationPermission?: boolean;
  requestIgnoreBatteryOptimizations?: boolean;
}

/** Options accepted by background configuration and start operations. */
export interface BackgroundLocationOptions {
  trackingMode?: BackgroundTrackingMode;
  accuracy?: LocationAccuracyOptions;
  granularity?: AndroidGranularity;
  interval?: number;
  fastestInterval?: number;
  distanceFilter?: number;
  maxUpdateDelay?: number;
  waitForAccurateLocation?: boolean;
  persist?: boolean;
  /** Unset uses the native safety cap; `0` selects unbounded storage. */
  maxStoredLocations?: number;
  /** Unset uses the native safety cap; `0` selects unbounded storage. */
  maxStoredEvents?: number;
  stopOnTerminate?: boolean;
  startOnBoot?: boolean;
  android?: AndroidBackgroundLocationOptions;
  ios?: IOSBackgroundLocationOptions;
  geofencing?: GeofencingOptions;
  activityRecognition?: ActivityRecognitionOptions;
  sync?: BackgroundHttpSyncOptions;
}

/** Options for an explicit `startActivityRecognition()` call. */
export interface StartActivityRecognitionOptions {
  interval?: number;
  stopOnStill?: boolean;
  minimumConfidence?: number;
}

export interface BackgroundGeofenceEvent extends BackgroundEventBase {
  type: "geofence";
  geofence: GeofenceEvent;
}

export interface BackgroundActivityEvent extends BackgroundEventBase {
  type: "activity";
  activity: DetectedActivity;
}

/** Discriminated event delivered by background listeners and tasks. */
export type BackgroundEvent =
  | BackgroundLocationEvent
  | BackgroundGeofenceEvent
  | BackgroundActivityEvent
  | BackgroundProviderChangeEvent
  | BackgroundLifecycleEvent
  | BackgroundHttpSyncEvent
  | BackgroundErrorEvent;

export interface StoredBackgroundEvent extends BackgroundEventBase {
  event: BackgroundEvent;
  createdAt: number;
}

export type BackgroundTaskHandler = (
  event: BackgroundEvent
) => void | Promise<void>;
