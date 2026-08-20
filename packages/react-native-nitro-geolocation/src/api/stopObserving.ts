import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
import { devtoolsStopObserving } from "../devtools/watchPosition";

/**
 * Stop ALL watch subscriptions immediately.
 *
 * Use cases:
 * - Emergency cleanup
 * - App termination
 * - User logout
 *
 * Note: Individual subscriptions should use unwatch() instead.
 * @example
 * ```tsx
 * import { stopObserving } from 'react-native-nitro-geolocation';
 *
 * // Stop all location tracking
 * stopObserving();
 * ```
 */
export function stopObserving(): void {
  devtoolsStopObserving();
  NitroGeolocationHybridObject.stopObserving();
}
