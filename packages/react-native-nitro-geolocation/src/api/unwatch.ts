import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";

/**
 * Stop a specific watch subscription.
 *
 * @param token - Subscription token from watchPosition()
 * @example
 * ```tsx
 * import { watchPosition, unwatch } from 'react-native-nitro-geolocation';
 *
 * const token = watchPosition((position) => console.log(position));
 * // Later...
 * unwatch(token);
 * ```
 */
export function unwatch(token: string): void {
  NitroGeolocationHybridObject.unwatch(token);
}
