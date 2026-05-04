import type { LocationError } from "../NitroGeolocation.nitro";
import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
import type { Heading, HeadingOptions } from "../publicTypes";

/**
 * Start watching platform heading updates.
 *
 * @param success - Called on each heading update
 * @param error - Called when heading is unavailable or options are invalid
 * @param options - Heading watch options
 * @returns Subscription token for cleanup with `unwatch(token)`
 */
export function watchHeading(
  success: (heading: Heading) => void,
  error?: (error: LocationError) => void,
  options?: HeadingOptions
): string {
  return NitroGeolocationHybridObject.watchHeading(success, error, options);
}
