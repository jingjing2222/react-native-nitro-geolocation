import type { HybridObject } from "react-native-nitro-modules";
import type { GeolocationResponse } from "./types";

/**
 * Permission status for location services.
 * Matches native permission states across iOS and Android.
 */
export type PermissionStatus =
  | "granted"      // User has granted location permission
  | "denied"       // User has denied permission
  | "restricted"   // Permission is restricted (iOS parental controls)
  | "undetermined" // Permission not yet requested

/**
 * iOS authorization level.
 */
export type AuthorizationLevel = "always" | "whenInUse" | "auto";

/**
 * Android location provider.
 */
export type LocationProvider = "playServices" | "android" | "auto";

/**
 * Global configuration for geolocation services.
 * Set once via GeolocationProvider.
 */
export interface ModernGeolocationConfiguration {
  /**
   * Automatically request location permission when GeolocationProvider mounts.
   * When true, permission is requested immediately on app start.
   * When false, you must manually call useRequestPermission().
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
   * - 'android': Use Android platform LocationManager
   * - 'auto': Auto-select (prefer Play Services if available)
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

  /** Enable high accuracy mode (GPS) */
  enableHighAccuracy?: boolean;

  /** Minimum time interval between updates in milliseconds (watch only) */
  interval?: number;

  /** Fastest interval for updates in milliseconds (Android watch only) */
  fastestInterval?: number;

  /** Minimum distance change in meters for updates (watch only) */
  distanceFilter?: number;

  /** Use significant location changes mode (iOS watch only) */
  useSignificantChanges?: boolean;
}

/**
 * Location error structure.
 */
export interface LocationError {
  code: number;    // 1: PERMISSION_DENIED, 2: POSITION_UNAVAILABLE, 3: TIMEOUT
  message: string;
}


/**
 * Modern Geolocation Nitro Module.
 *
 * Key Features:
 * - Promise-based for async operations
 * - First-class function callbacks for continuous updates
 * - Token-based subscriptions (internal use only)
 * - Type-safe across JS ↔ Native boundary
 */
export interface NitroGeolocation
  extends HybridObject<{ ios: "swift"; android: "kotlin" }> {

  /**
   * Set global geolocation configuration.
   * Should be called once at app startup via GeolocationProvider.
   *
   * @param config - Platform-specific configuration
   */
  setConfiguration(config: ModernGeolocationConfiguration): void;

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
   * @returns Promise resolving to new permission status
   */
  requestPermission(): Promise<PermissionStatus>;

  /**
   * Get current location (one-time request).
   *
   * Strategy:
   * 1. Check cached location (if maximumAge allows)
   * 2. Request fresh location from GPS/Network
   * 3. Timeout after specified duration
   *
   * @param options - Location request options
   * @returns Promise resolving to current position
   * @throws LocationError if permission denied, timeout, or unavailable
   */
  getCurrentPosition(
    options?: LocationRequestOptions
  ): Promise<GeolocationResponse>;

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
    error?: (error: LocationError) => void,
    options?: LocationRequestOptions
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
