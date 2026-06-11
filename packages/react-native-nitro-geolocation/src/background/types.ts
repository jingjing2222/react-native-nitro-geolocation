import type {
  LocationError,
  PermissionStatus
} from "../NitroGeolocation.nitro";
import type {
  AccuracyAuthorization,
  AndroidGranularity,
  GeolocationResponse,
  LocationAccuracyOptions,
  LocationProviderStatus,
  LocationProviderUsed
} from "../publicTypes";

export type BackgroundPermissionStatus =
  | "granted"
  | "denied"
  | "restricted"
  | "undetermined";

export interface BackgroundPermissionResult {
  foreground: PermissionStatus;
  background: BackgroundPermissionStatus;
  accuracyAuthorization?: AccuracyAuthorization;
  canRequestBackgroundInline?: boolean;
  needsSettingsRedirect?: boolean;
}

export type BackgroundLocationState =
  | "idle"
  | "starting"
  | "running"
  | "stopping"
  | "stopped"
  | "error";

export interface AndroidBackgroundLocationStatus {
  isForegroundServiceRunning: boolean;
  isIgnoringBatteryOptimizations?: boolean;
  notificationPermission?: PermissionStatus;
}

export interface IOSBackgroundLocationStatus {
  allowsBackgroundLocationUpdates: boolean;
  significantChangesEnabled: boolean;
}

export interface BackgroundLocationStatus {
  state: BackgroundLocationState;
  isRunning: boolean;
  isConfigured: boolean;
  foregroundPermission: PermissionStatus;
  backgroundPermission: BackgroundPermissionStatus;
  accuracyAuthorization?: AccuracyAuthorization;
  locationServicesEnabled: boolean;
  providerStatus?: LocationProviderStatus;
  storedLocationCount: number;
  storedEventCount: number;
  geofenceCount: number;
  android?: AndroidBackgroundLocationStatus;
  ios?: IOSBackgroundLocationStatus;
  lastError?: LocationError;
}

export type BackgroundTrackingMode =
  | "continuous"
  | "significantChanges"
  | "activityAware";

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
  /**
   * Max number of locations retained in the on-device store before older rows are pruned.
   * Unset → a built-in safety cap (the native default). Set to `0` for UNBOUNDED storage.
   */
  maxStoredLocations?: number;
  /**
   * Max number of events retained in the on-device store before older rows are pruned.
   * Unset → a built-in safety cap (the native default). Set to `0` for UNBOUNDED storage.
   */
  maxStoredEvents?: number;
  stopOnTerminate?: boolean;
  startOnBoot?: boolean;
  android?: AndroidBackgroundLocationOptions;
  ios?: IOSBackgroundLocationOptions;
  geofencing?: GeofencingOptions;
  activityRecognition?: ActivityRecognitionOptions;
  sync?: BackgroundHttpSyncOptions;
}

export type AndroidBackgroundProvider =
  | "auto"
  | "playServices"
  | "android_platform";

export interface AndroidBackgroundLocationOptions {
  locationProvider?: AndroidBackgroundProvider;
  foregroundService: AndroidForegroundServiceOptions;
  requestNotificationPermission?: boolean;
  requestIgnoreBatteryOptimizations?: boolean;
}

export interface AndroidForegroundServiceOptions {
  notificationId?: number;
  notificationTitle: string;
  notificationText: string;
  notificationChannelId?: string;
  notificationChannelName?: string;
  notificationChannelDescription?: string;
  notificationIcon?: string;
  notificationColor?: string;
  stopActionTitle?: string;
}

export type IOSBackgroundActivityType =
  | "other"
  | "automotiveNavigation"
  | "fitness"
  | "otherNavigation"
  | "airborne";

export interface IOSBackgroundLocationOptions {
  activityType?: IOSBackgroundActivityType;
  pausesLocationUpdatesAutomatically?: boolean;
  showsBackgroundLocationIndicator?: boolean;
  useSignificantChanges?: boolean;
  deferredUpdatesDistance?: number;
  deferredUpdatesInterval?: number;
}

export type BackgroundLocationSource =
  | "foregroundService"
  | "background"
  | "significantChange"
  | "geofence"
  | "deferred"
  | "manual"
  | "unknown";

export interface BatterySnapshot {
  level?: number;
  isCharging?: boolean;
}

export interface BackgroundLocation extends GeolocationResponse {
  id?: string;
  source: BackgroundLocationSource;
  isFromBackground: boolean;
  provider?: LocationProviderUsed;
  mocked?: boolean;
  recordedAt: number;
  activity?: DetectedActivity;
  battery?: BatterySnapshot;
}

export interface StoredBackgroundLocation extends BackgroundLocation {
  id: string;
  deliveredToJS: boolean;
  synced: boolean;
  createdAt: number;
}

export type BackgroundEventType =
  | "location"
  | "geofence"
  | "activity"
  | "providerChange"
  | "httpSync"
  | "error";

export interface BackgroundEventBase {
  id: string;
  type: BackgroundEventType;
  timestamp: number;
  deliveredToJS: boolean;
}

export interface BackgroundLocationEvent extends BackgroundEventBase {
  type: "location";
  location: BackgroundLocation;
}

export interface BackgroundGeofenceEventEnvelope extends BackgroundEventBase {
  type: "geofence";
  geofence: GeofenceEvent;
}

export interface BackgroundActivityEventEnvelope extends BackgroundEventBase {
  type: "activity";
  activity: DetectedActivity;
}

export interface BackgroundProviderChangeEvent extends BackgroundEventBase {
  type: "providerChange";
  providerStatus: LocationProviderStatus;
}

export interface BackgroundHttpSyncEvent extends BackgroundEventBase {
  type: "httpSync";
  result: BackgroundHttpSyncResult;
}

export interface BackgroundErrorEvent extends BackgroundEventBase {
  type: "error";
  error: LocationError;
}

export interface BackgroundEventEnvelope extends BackgroundEventBase {
  location?: BackgroundLocation;
  geofence?: GeofenceEvent;
  activity?: DetectedActivity;
  providerStatus?: LocationProviderStatus;
  result?: BackgroundHttpSyncResult;
  error?: LocationError;
}

export type BackgroundEvent =
  | BackgroundLocationEvent
  | BackgroundGeofenceEventEnvelope
  | BackgroundActivityEventEnvelope
  | BackgroundProviderChangeEvent
  | BackgroundHttpSyncEvent
  | BackgroundErrorEvent;

export type GeofenceTransition = "enter" | "exit" | "dwell";

export interface GeofenceRegion {
  identifier: string;
  latitude: number;
  longitude: number;
  radius: number;
  notifyOnEntry?: boolean;
  notifyOnExit?: boolean;
  notifyOnDwell?: boolean;
  loiteringDelay?: number;
  expirationDuration?: number;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface GeofencingOptions {
  initialTrigger?: GeofenceTransition[];
  notificationResponsiveness?: number;
}

export interface GeofenceEvent {
  region: GeofenceRegion;
  transition: GeofenceTransition;
  location?: BackgroundLocation;
  timestamp: number;
}

export type DetectedActivityType =
  | "still"
  | "walking"
  | "running"
  | "onFoot"
  | "onBicycle"
  | "inVehicle"
  | "tilting"
  | "unknown";

export interface DetectedActivity {
  type: DetectedActivityType;
  confidence: number;
  timestamp: number;
}

export interface ActivityRecognitionOptions {
  enabled?: boolean;
  interval?: number;
  stopOnStill?: boolean;
  minimumConfidence?: number;
}

export type BackgroundHttpMethod = "POST" | "PUT" | "PATCH";

export interface BackgroundHttpSyncOptions {
  url: string;
  method?: BackgroundHttpMethod;
  headers?: Record<string, string>;
  batch?: boolean;
  batchSize?: number;
  syncThreshold?: number;
  syncInterval?: number;
  retry?: boolean;
  maxRetries?: number;
  bodyTemplate?: Record<string, string | number | boolean | null>;
  autoClear?: boolean;
}

export interface BackgroundHttpSyncResult {
  success: boolean;
  statusCode?: number;
  syncedLocationIds: string[];
  failedLocationIds: string[];
  error?: string;
}

export interface StoredBackgroundEvent extends BackgroundEventBase {
  event: BackgroundEvent;
  createdAt: number;
}

export interface StoredBackgroundEventEnvelope extends BackgroundEventBase {
  event: BackgroundEventEnvelope;
  createdAt: number;
}

export interface GetStoredBackgroundLocationsOptions {
  limit?: number;
  since?: number;
  includeDelivered?: boolean;
  includeSynced?: boolean;
}

export interface GetStoredBackgroundEventsOptions {
  types?: BackgroundEventType[];
  limit?: number;
  since?: number;
  includeDelivered?: boolean;
}

export interface BackgroundSubscription {
  remove(): void;
}

export type BackgroundTaskHandler = (
  event: BackgroundEvent
) => void | Promise<void>;
