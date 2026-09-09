import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
import type { LocationProviderStatus } from "../publicTypes";

/**
 * Observe app authorization scope and device provider/settings readiness.
 *
 * The callback receives an asynchronous initial snapshot and then only
 * distinct changes. This API never opens settings or requests permission.
 * On iOS and Android, `authorizationStatus` distinguishes `always`,
 * `whenInUse`, and unavailable authorization, including changes in Settings.
 *
 * @returns Subscription token for cleanup with `unwatch(token)`
 */
export function watchProviderStatus(
  success: (status: LocationProviderStatus) => void
): string {
  return NitroGeolocationHybridObject.watchProviderStatus(success);
}
