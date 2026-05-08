import type { HybridObject } from "react-native-nitro-modules";
import type {
  AccuracyAuthorization,
  AndroidGranularity,
  GeocodedLocation,
  GeocodingCoordinates,
  GeolocationResponse,
  Heading,
  HeadingOptions,
  IOSActivityType,
  LocationAccuracyOptions,
  LocationAvailability,
  LocationProviderStatus,
  ReverseGeocodedAddress
} from "./types";

/**
 * Permission status for location services.
 * Matches native permission states across iOS and Android.
 */
export type PermissionStatus =
  | "granted" // User has granted location permission
  | "denied" // User has denied permission
  | "restricted" // Permission is restricted (iOS parental controls)
  | "undetermined"; // Permission not yet requested

/**
 * iOS authorization level.
 */
export type AuthorizationLevel = "always" | "whenInUse" | "auto";

/**
 * Android location provider (internal).
 * Note: Use "android_platform" instead of "android" to avoid C++ macro conflicts.
 */
export type LocationProvider = "playServices" | "android_platform" | "auto";

/**
 * Global configuration for geolocation services.
 * Apply once at app startup with `setConfiguration()`.
 */
export interface GeolocationConfiguration {
  /**
   * @deprecated This option is accepted for backward compatibility only.
   * `setConfiguration()` does not request permission. Call
   * `requestPermission()` explicitly when your app is ready to show the native
   * permission prompt.
   * @default false
   */
  autoRequestPermission?: boolean;

  /**
   * iOS: Authorization level
   * - 'always': Request "Always" permission (background + foreground)
   * - 'whenInUse': Request "When In Use" permission (foreground only)
   * - 'auto': Auto-detect from Info.plist keys
   */
  authorizationLevel?: AuthorizationLevel;

  /**
   * iOS: Enable background location updates.
   * Requires "UIBackgroundModes" with "location" in Info.plist.
   */
  enableBackgroundLocationUpdates?: boolean;

  /**
   * Android: Location provider
   * - 'playServices': Use Google Play Services (fused location)
   * - 'android_platform': Use Android platform LocationManager
   * - 'auto': Use Android platform LocationManager by default
   */
  locationProvider?: LocationProvider;
}

/**
 * Options for location requests.
 */
export interface LocationRequestOptions {
  /** Timeout in milliseconds (default: 600000 / 10 minutes) */
  timeout?: number;

  /** Maximum age of cached location in milliseconds (default: 0) */
  maximumAge?: number;

  /**
   * Enable high accuracy mode (GPS).
   *
   * @deprecated Since v1.2, use `accuracy` for explicit platform-native
   * presets. This remains available for v1 compatibility and is planned for
   * removal from the Modern API in v2.
   */
  enableHighAccuracy?: boolean;

  /**
   * Platform-specific accuracy preset.
   *
   * Available since v1.2.
   *
   * When provided, this takes precedence over `enableHighAccuracy` on the
   * matching platform while keeping `enableHighAccuracy` available for the
   * legacy true/false contract.
   */
  accuracy?: LocationAccuracyOptions;

  /** Minimum time interval between updates in milliseconds (watch only) */
  interval?: number;

  /** Fastest interval for updates in milliseconds (Android watch only) */
  fastestInterval?: number;

  /** Minimum distance change in meters for updates (watch only) */
  distanceFilter?: number;

  /**
   * Android-only location granularity.
   *
   * Available since v1.2.
   *
   * `permission` follows the granted permission level, `coarse` prevents fine
   * GPS-only requests from being used, and `fine` requires fine location
   * permission.
   */
  granularity?: AndroidGranularity;

  /**
   * Android-only option for high-accuracy initial updates.
   *
   * Available since v1.2.
   */
  waitForAccurateLocation?: boolean;

  /**
   * Android-only maximum age for an initial update in milliseconds.
   *
   * Available since v1.2.
   */
  maxUpdateAge?: number;

  /**
   * Android-only maximum batching delay in milliseconds.
   *
   * Available since v1.2.
   */
  maxUpdateDelay?: number;

  /**
   * Android-only maximum number of updates before a watch stops itself.
   *
   * Available since v1.2.
   */
  maxUpdates?: number;

  /** Use significant location changes mode (iOS watch only) */
  useSignificantChanges?: boolean;

  /**
   * iOS-only activity type used to tune Core Location behavior.
   *
   * Available since v1.2.
   */
  activityType?: IOSActivityType;

  /**
   * iOS-only setting for automatic pausing of location updates.
   *
   * Available since v1.2.
   */
  pausesLocationUpdatesAutomatically?: boolean;

  /**
   * iOS-only setting for the background location indicator.
   *
   * Requires background location capability and is ignored by Android.
   *
   * Available since v1.2.
   */
  showsBackgroundLocationIndicator?: boolean;
}

/**
 * Android-only location settings request options.
 *
 * Used by `requestLocationSettings()` on Android to build the native
 * `LocationSettingsRequest`. On iOS these options are ignored because iOS does
 * not provide an equivalent system settings resolution dialog.
 */
export interface LocationSettingsOptions {
  /**
   * Request high accuracy Android location settings.
   * Defaults to true because this API is primarily used before user-facing
   * precise location flows.
   *
   * @deprecated Since v1.2, use `accuracy.android` for explicit Android
   * settings priorities. This remains available for v1 compatibility and is
   * planned for removal from the Modern API in v2.
   */
  enableHighAccuracy?: boolean;

  /**
   * Platform-specific accuracy preset for settings checks.
   *
   * Available since v1.2.
   *
   * Android uses `accuracy.android` to map to the native location request
   * priority. iOS ignores this option because iOS has no equivalent settings
   * resolution dialog.
   */
  accuracy?: LocationAccuracyOptions;

  /** Desired update interval in milliseconds. */
  interval?: number;

  /** Fastest acceptable update interval in milliseconds. */
  fastestInterval?: number;

  /** Minimum distance change in meters. */
  distanceFilter?: number;

  /** Ask Android to always show the resolution dialog when possible. */
  alwaysShow?: boolean;

  /** Require BLE availability for the location settings request. */
  needBle?: boolean;
}

/**
 * Location error structure.
 */
export interface LocationError {
  // -1: INTERNAL_ERROR, 1: PERMISSION_DENIED, 2: POSITION_UNAVAILABLE,
  // 3: TIMEOUT, 4: PLAY_SERVICE_NOT_AVAILABLE, 5: SETTINGS_NOT_SATISFIED
  code: number;
  message: string;
}

/**
 * Geolocation Nitro Module.
 *
 * Key Features:
 * - Public async APIs are wrapped in JS Promises
 * - Native sends structured LocationError callbacks
 * - First-class function callbacks for continuous updates
 * - Token-based subscriptions (internal use only)
 * - Type-safe across JS ↔ Native boundary
 */
export interface NitroGeolocation
  extends HybridObject<{ ios: "swift"; android: "kotlin" }> {
  /**
   * Set global geolocation configuration.
   * Should be called once at app startup before location requests.
   *
   * @param config - Platform-specific configuration
   */
  setConfiguration(config: GeolocationConfiguration): void;

  /**
   * Check current location permission status.
   * Does NOT request permission, only checks current state.
   *
   * @returns Promise resolving to current permission status
   */
  checkPermission(): Promise<PermissionStatus>;

  /**
   * Request location permission from the user.
   * Shows system permission dialog if not yet determined.
   *
   * Internal native contract. The public JS API wraps this in a Promise so
   * native remains the source of truth for structured LocationError objects.
   */
  requestPermission(
    success: (status: PermissionStatus) => void,
    error?: (error: LocationError) => void
  ): void;

  /**
   * Check whether device-level location services are enabled.
   *
   * Android: checks Android system location/provider state.
   * iOS: maps to `CLLocationManager.locationServicesEnabled()`.
   */
  hasServicesEnabled(): Promise<boolean>;

  /**
   * Get native provider/settings state.
   *
   * Android: returns Android provider availability and Google Location Accuracy
   * state when available.
   *
   * iOS: returns Core Location service availability and app background location
   * mode only. Android-specific provider fields are `undefined`.
   */
  getProviderStatus(): Promise<LocationProviderStatus>;

  /**
   * Get whether the current platform is likely to deliver location updates.
   *
   * Android: uses Fused Location availability when the configured provider is
   * Play Services, otherwise falls back to platform provider/service checks.
   *
   * iOS: maps Core Location service and authorization state.
   */
  getLocationAvailability(): Promise<LocationAvailability>;

  /**
   * Android-only settings resolution API.
   *
   * Android: checks whether current device settings satisfy the requested
   * location requirements and shows the native settings resolution dialog when
   * Android can resolve the mismatch.
   *
   * iOS: does not show a settings dialog and ignores `options`. It resolves
   * with `locationServicesEnabled`, `backgroundModeEnabled`, and `undefined`
   * Android-specific provider fields.
   */
  requestLocationSettings(
    success: (status: LocationProviderStatus) => void,
    options: LocationSettingsOptions,
    error?: (error: LocationError) => void
  ): void;

  /**
   * Get current platform location accuracy authorization.
   *
   * iOS: maps Core Location full/reduced accuracy authorization.
   * Android: maps fine permission to `full` and coarse-only permission to
   * `reduced`.
   */
  getAccuracyAuthorization(): Promise<AccuracyAuthorization>;

  /**
   * iOS-only temporary full accuracy request.
   *
   * iOS: calls Core Location temporary full accuracy authorization with the
   * provided Info.plist purpose key.
   * Android: resolves with the current accuracy authorization without showing
   * a prompt.
   */
  requestTemporaryFullAccuracy(
    purposeKey: string,
    success: (authorization: AccuracyAuthorization) => void,
    error?: (error: LocationError) => void
  ): void;

  /**
   * Get current location (one-time request).
   *
   * Strategy:
   * 1. Check cached location (if maximumAge allows)
   * 2. Request fresh location from GPS/Network
   * 3. Timeout after specified duration
   *
   * Internal native contract. The public JS API wraps this in a Promise so
   * native remains the source of truth for structured LocationError objects.
   *
   * @param success - Called with the current position
   * @param error - Called with native-classified LocationError
   * @param options - Location request options
   */
  getCurrentPosition(
    success: (position: GeolocationResponse) => void,
    options: LocationRequestOptions,
    error?: (error: LocationError) => void
  ): void;

  /**
   * Get the best cached location without starting a fresh location request.
   *
   * Returns `POSITION_UNAVAILABLE` when no cached location satisfies `options`.
   */
  getLastKnownPosition(
    success: (position: GeolocationResponse) => void,
    options: LocationRequestOptions,
    error?: (error: LocationError) => void
  ): void;

  /**
   * Convert a human-readable address into candidate coordinates.
   *
   * Uses the platform geocoder: Android `Geocoder` and iOS `CLGeocoder`.
   * Results and availability depend on platform networking/geocoder services.
   */
  geocode(
    address: string,
    success: (locations: GeocodedLocation[]) => void,
    error?: (error: LocationError) => void
  ): void;

  /**
   * Convert coordinates into candidate human-readable addresses.
   *
   * Uses the platform geocoder: Android `Geocoder` and iOS `CLGeocoder`.
   * Results and availability depend on platform networking/geocoder services.
   */
  reverseGeocode(
    coords: GeocodingCoordinates,
    success: (addresses: ReverseGeocodedAddress[]) => void,
    error?: (error: LocationError) => void
  ): void;

  /**
   * Get one heading reading from the platform heading sensor.
   */
  getHeading(
    success: (heading: Heading) => void,
    error?: (error: LocationError) => void
  ): void;

  /**
   * Start watching heading updates.
   *
   * Use `unwatch(token)` to stop a heading watch.
   */
  watchHeading(
    success: (heading: Heading) => void,
    options: HeadingOptions,
    error?: (error: LocationError) => void
  ): string;

  /**
   * Start watching for continuous location updates.
   *
   * IMPORTANT: This is a LOW-LEVEL API.
   * Users should use useWatchPosition() hook instead.
   *
   * Nitro Advantage: Functions are first-class citizens!
   * We can store callbacks and call them multiple times,
   * unlike Turbo Modules which require Events.
   *
   * @param success - Called on each successful location update
   * @param error - Called when an error occurs
   * @param options - Location request options
   * @returns Subscription token (UUID string) for cleanup
   */
  watchPosition(
    success: (position: GeolocationResponse) => void,
    options: LocationRequestOptions,
    error?: (error: LocationError) => void
  ): string;

  /**
   * Stop a specific watch subscription.
   *
   * IMPORTANT: This is a LOW-LEVEL API.
   * Cleanup is handled automatically by useWatchPosition() hook.
   *
   * @param token - Subscription token from watchPosition()
   */
  unwatch(token: string): void;

  /**
   * Stop ALL watch subscriptions immediately.
   *
   * Use cases:
   * - Emergency cleanup
   * - App termination
   * - User logout
   *
   * Note: Individual subscriptions should use unwatch() instead.
   */
  stopObserving(): void;
}
