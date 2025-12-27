import type {
  LocationError,
  LocationRequestOptions,
  PermissionStatus,
  ModernGeolocationConfiguration as NitroModernGeolocationConfiguration
} from "./NitroGeolocation.nitro";
import { NitroGeolocationHybridObject } from "./NitroGeolocationModule";
import type { ModernGeolocationConfiguration } from "./types";
import type { GeolocationResponse } from "./types";

export interface GeolocationClientConfig extends ModernGeolocationConfiguration {}

/**
 * GeolocationClient provides direct access to geolocation methods.
 *
 * Usage:
 * ```tsx
 * // With provider
 * const client = new GeolocationClient({ locationProvider: 'auto' });
 * <GeolocationClientProvider client={client}>
 *   <App />
 * </GeolocationClientProvider>
 *
 * // Without provider
 * const standaloneClient = new GeolocationClient();
 * await standaloneClient.getCurrentPosition();
 * ```
 */
export class GeolocationClient {
  private config: GeolocationClientConfig;

  constructor(config: GeolocationClientConfig = {}) {
    this.config = config;

    // Set configuration on Nitro module
    if (Object.keys(config).length > 0) {
      const nativeConfig: NitroModernGeolocationConfiguration = {
        ...config,
        locationProvider:
          config.locationProvider === "android"
            ? "android_platform"
            : config.locationProvider
      };

      NitroGeolocationHybridObject.setConfiguration(nativeConfig);
    }
  }

  /**
   * Check current location permission status.
   * Does NOT request permission, only checks current state.
   */
  checkPermission = (): Promise<PermissionStatus> => {
    return NitroGeolocationHybridObject.checkPermission();
  };

  /**
   * Request location permission from the user.
   * Shows system permission dialog if not yet determined.
   */
  requestPermission = (): Promise<PermissionStatus> => {
    return NitroGeolocationHybridObject.requestPermission();
  };

  /**
   * Get current location (one-time request).
   *
   * @param options - Location request options
   * @returns Promise resolving to current position
   */
  getCurrentPosition = (
    options?: LocationRequestOptions
  ): Promise<GeolocationResponse> => {
    return NitroGeolocationHybridObject.getCurrentPosition(options);
  };

  /**
   * Start watching for continuous location updates.
   *
   * @param success - Called on each successful location update
   * @param error - Called when an error occurs
   * @param options - Location request options
   * @returns Subscription token (UUID string) for cleanup
   */
  watchPosition = (
    success: (position: GeolocationResponse) => void,
    error?: (error: LocationError) => void,
    options?: LocationRequestOptions
  ): string => {
    return NitroGeolocationHybridObject.watchPosition(success, error, options);
  };

  /**
   * Stop a specific watch subscription.
   *
   * @param token - Subscription token from watchPosition()
   */
  unwatch = (token: string): void => {
    NitroGeolocationHybridObject.unwatch(token);
  };

  /**
   * Stop ALL watch subscriptions immediately.
   */
  stopObserving = (): void => {
    NitroGeolocationHybridObject.stopObserving();
  };

  /**
   * Get the current client configuration.
   */
  getConfig = (): Readonly<GeolocationClientConfig> => {
    return { ...this.config };
  };
}
