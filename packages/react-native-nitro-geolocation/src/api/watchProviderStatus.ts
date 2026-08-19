import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
import type { LocationProviderStatus } from "../publicTypes";

/**
 * Observe device provider/settings readiness.
 *
 * The callback receives an asynchronous initial snapshot and then only
 * distinct changes. This API never opens settings or requests permission.
 *
 * @returns Subscription token for cleanup with `unwatch(token)`
 */
export function watchProviderStatus(
  success: (status: LocationProviderStatus) => void
): string {
  return NitroGeolocationHybridObject.watchProviderStatus(success);
}
