import type { HybridObject } from "react-native-nitro-modules";
import type { LocationError } from "../NitroGeolocation.nitro";
import type {
  ActivityRecognitionOptions,
  BackgroundEventEnvelope,
  BackgroundEventType,
  BackgroundHttpSyncResult,
  BackgroundLocation,
  BackgroundLocationOptions,
  BackgroundLocationStatus,
  BackgroundPermissionResult,
  DetectedActivity,
  GeofenceEvent,
  GeofenceRegion,
  GeofencingOptions,
  GetStoredBackgroundEventsOptions,
  GetStoredBackgroundLocationsOptions,
  StoredBackgroundEventEnvelope,
  StoredBackgroundLocation
} from "./types";

export interface NitroBackgroundLocation
  extends HybridObject<{ ios: "swift"; android: "kotlin" }> {
  checkBackgroundPermission(): Promise<BackgroundPermissionResult>;
  requestBackgroundPermission(): Promise<BackgroundPermissionResult>;
  openAppLocationSettings(): Promise<void>;
  configureBackgroundLocation(
    options: BackgroundLocationOptions
  ): Promise<void>;
  getBackgroundConfiguration(): Promise<BackgroundLocationOptions | undefined>;
  startBackgroundLocation(options?: BackgroundLocationOptions): Promise<void>;
  stopBackgroundLocation(): Promise<void>;
  resetBackgroundLocation(): Promise<void>;
  getBackgroundLocationStatus(): Promise<BackgroundLocationStatus>;
  addBackgroundEventListener(
    listener: (event: BackgroundEventEnvelope) => void
  ): string;
  removeBackgroundEventListener(token: string): void;
  addBackgroundLocationListener(
    listener: (location: BackgroundLocation) => void
  ): string;
  removeBackgroundLocationListener(token: string): void;
  addBackgroundErrorListener(listener: (error: LocationError) => void): string;
  removeBackgroundErrorListener(token: string): void;
  getStoredBackgroundLocations(
    options?: GetStoredBackgroundLocationsOptions
  ): Promise<StoredBackgroundLocation[]>;
  clearStoredBackgroundLocations(ids?: string[]): Promise<void>;
  markStoredBackgroundLocationsDelivered(ids: string[]): Promise<void>;
  getStoredBackgroundEvents(
    options?: GetStoredBackgroundEventsOptions
  ): Promise<StoredBackgroundEventEnvelope[]>;
  clearStoredBackgroundEvents(ids?: string[]): Promise<void>;
  markStoredBackgroundEventsDelivered(ids: string[]): Promise<void>;
  addGeofences(
    regions: GeofenceRegion[],
    options?: GeofencingOptions
  ): Promise<void>;
  removeGeofences(identifiers?: string[]): Promise<void>;
  getRegisteredGeofences(): Promise<GeofenceRegion[]>;
  startActivityRecognition(options?: ActivityRecognitionOptions): Promise<void>;
  stopActivityRecognition(): Promise<void>;
  syncStoredLocations(): Promise<BackgroundHttpSyncResult>;
}

export type {
  ActivityRecognitionOptions,
  BackgroundEventEnvelope,
  BackgroundEventType,
  BackgroundHttpSyncResult,
  BackgroundLocation,
  BackgroundLocationOptions,
  BackgroundLocationStatus,
  BackgroundPermissionResult,
  DetectedActivity,
  GeofenceEvent,
  GeofenceRegion,
  GeofencingOptions,
  GetStoredBackgroundEventsOptions,
  GetStoredBackgroundLocationsOptions,
  StoredBackgroundEventEnvelope,
  StoredBackgroundLocation
};
