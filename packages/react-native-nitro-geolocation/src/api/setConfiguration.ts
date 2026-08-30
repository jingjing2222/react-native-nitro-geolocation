import type { NitroGeolocation } from "../NitroGeolocation.nitro";
import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
import type {
  GeolocationConfiguration,
  LocationProvider
} from "../publicTypes";

type NitroGeolocationConfiguration = Parameters<
  NitroGeolocation["setConfiguration"]
>[0];

let configuredLocationProvider: LocationProvider | undefined;

/** @internal Current provider preference for JS-level diagnosis. */
export function getConfiguredLocationProvider(): LocationProvider | undefined {
  return configuredLocationProvider;
}

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
export function setConfiguration(config: GeolocationConfiguration): void {
  const nativeConfig: NitroGeolocationConfiguration = {
    ...config,
    locationProvider:
      config.locationProvider === "android"
        ? "android_platform"
        : config.locationProvider
  };

  NitroGeolocationHybridObject.setConfiguration(nativeConfig);
  configuredLocationProvider = config.locationProvider;
}
