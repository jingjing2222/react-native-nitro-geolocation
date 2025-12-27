/**
 * Represents a location request with its configuration options.
 */
export interface LocationRequest {
  /** Whether high accuracy mode is enabled */
  enableHighAccuracy: boolean;
  /** Minimum distance change (in meters) for updates */
  distanceFilter: number;
}

/**
 * Accuracy level for location services.
 * - 'high': GPS-level accuracy (~5-10 meters)
 * - 'medium': Network-assisted accuracy (~100 meters)
 * - 'low': Cell tower accuracy (~1000+ meters)
 */
export type AccuracyLevel = 'high' | 'medium' | 'low';

/**
 * Merged configuration representing the optimal settings
 * for multiple concurrent location requests.
 */
export interface MergedConfiguration {
  /** The best (highest) accuracy level among all requests */
  bestAccuracy: AccuracyLevel;
  /** The smallest (most sensitive) distance filter among all requests */
  smallestDistanceFilter: number;
}

/**
 * Merges multiple location request configurations to determine
 * the optimal settings that satisfy all requests.
 *
 * This is important for battery optimization - when multiple watches
 * or getCurrentPosition calls are active simultaneously, we should use
 * the most demanding settings to satisfy all requests with a single
 * location subscription.
 *
 * Strategy:
 * - Use the highest accuracy level requested by any client
 * - Use the smallest distance filter to ensure all clients get updates
 *
 * @param requests - Array of location requests to merge
 * @returns Merged configuration with optimal settings
 *
 * @example
 * ```ts
 * const requests = [
 *   { enableHighAccuracy: false, distanceFilter: 100 },
 *   { enableHighAccuracy: true, distanceFilter: 10 },
 *   { enableHighAccuracy: false, distanceFilter: 50 }
 * ];
 *
 * const merged = mergeConfigurations(requests);
 * // Result: { bestAccuracy: 'high', smallestDistanceFilter: 10 }
 * ```
 */
export function mergeConfigurations(
  requests: LocationRequest[]
): MergedConfiguration {
  // If no requests, return default low-power settings
  if (requests.length === 0) {
    return {
      bestAccuracy: 'low',
      smallestDistanceFilter: 0,
    };
  }

  let bestAccuracy: AccuracyLevel = 'low';
  let smallestDistanceFilter = Number.POSITIVE_INFINITY;

  // Iterate through all requests to find the most demanding settings
  for (const request of requests) {
    // If any request needs high accuracy, use high accuracy
    if (request.enableHighAccuracy) {
      bestAccuracy = 'high';
    }

    // Use the smallest distance filter
    smallestDistanceFilter = Math.min(
      smallestDistanceFilter,
      request.distanceFilter
    );
  }

  return {
    bestAccuracy,
    smallestDistanceFilter:
      smallestDistanceFilter === Number.POSITIVE_INFINITY ? 0 : smallestDistanceFilter,
  };
}
