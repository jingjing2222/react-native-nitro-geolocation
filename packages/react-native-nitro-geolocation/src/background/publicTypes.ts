import type {
  AndroidGranularity,
  LocationAccuracyOptions
} from "../publicTypes";
import type {
  ActivityRecognitionOptions,
  AndroidForegroundServiceOptions,
  BackgroundHttpSyncOptions,
  BackgroundTrackingMode,
  GeofencingOptions,
  IOSBackgroundLocationOptions
} from "./types";

export * from "./types";

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
