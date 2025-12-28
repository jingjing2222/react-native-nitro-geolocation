import type { ModernGeolocationConfiguration as NitroModernGeolocationConfiguration } from "../NitroGeolocation.nitro";
import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
import type { ModernGeolocationConfiguration } from "../types";

/**
 * Set global geolocation configuration.
 * Should be called once at app startup.
 *
 * @param config - Platform-specific configuration
 * @example
 * ```tsx
 * import { setConfiguration } from 'react-native-nitro-geolocation';
 *
 * setConfiguration({
 *   authorizationLevel: 'whenInUse',
 *   enableBackgroundLocationUpdates: false,
 *   locationProvider: 'auto'
 * });
 * ```
 */
export function setConfiguration(config: ModernGeolocationConfiguration): void {
  const nativeConfig: NitroModernGeolocationConfiguration = {
    ...config,
    locationProvider:
      config.locationProvider === "android"
        ? "android_platform"
        : config.locationProvider
  };

  NitroGeolocationHybridObject.setConfiguration(nativeConfig);
}
