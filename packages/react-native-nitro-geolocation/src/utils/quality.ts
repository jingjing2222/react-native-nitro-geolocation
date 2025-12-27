/**
 * Represents the quality characteristics of a location reading.
 */
export interface LocationQuality {
  /** Timestamp in milliseconds since epoch */
  timestampMs: number;
  /** Horizontal accuracy in meters */
  accuracyMeters: number;
  /** Location provider type */
  provider: 'gps' | 'network';
}

/** Time threshold for considering locations significantly newer/older (2 minutes) */
const TWO_MINUTES_MS = 2 * 60 * 1000;

/** Accuracy threshold for considering locations significantly less accurate (200 meters) */
const SIGNIFICANT_ACCURACY_DIFFERENCE_METERS = 200;

/**
 * Determines whether a new location is better than the current best location.
 * This algorithm considers both recency and accuracy of location readings.
 *
 * Based on Android's location quality evaluation best practices:
 * @see https://developer.android.com/develop/sensors-and-location/location/strategies#BestEstimate
 *
 * @param newLocation - The new location to evaluate
 * @param currentBest - The current best location, or null if none exists
 * @returns true if the new location is better, false otherwise
 *
 * @example
 * ```ts
 * const newLoc: LocationQuality = {
 *   timestampMs: Date.now(),
 *   accuracyMeters: 10,
 *   provider: 'gps'
 * };
 *
 * const currentBest: LocationQuality = {
 *   timestampMs: Date.now() - 60000, // 1 minute ago
 *   accuracyMeters: 50,
 *   provider: 'network'
 * };
 *
 * isBetterLocation(newLoc, currentBest); // true (newer and more accurate)
 * ```
 */
export function isBetterLocation(
  newLocation: LocationQuality,
  currentBest: LocationQuality | null
): boolean {
  // If there's no current best location, the new location is always better
  if (!currentBest) {
    return true;
  }

  // Calculate time difference between locations
  const timeDelta = newLocation.timestampMs - currentBest.timestampMs;
  const isSignificantlyNewer = timeDelta > TWO_MINUTES_MS;
  const isSignificantlyOlder = timeDelta < -TWO_MINUTES_MS;

  // If the new location is significantly newer, it's better
  if (isSignificantlyNewer) {
    return true;
  }

  // If the new location is significantly older, it's not better
  if (isSignificantlyOlder) {
    return false;
  }

  // Calculate accuracy difference
  const accuracyDelta = newLocation.accuracyMeters - currentBest.accuracyMeters;
  const isMoreAccurate = accuracyDelta < 0;
  const isLessAccurate = accuracyDelta > 0;
  const isSignificantlyLessAccurate =
    accuracyDelta > SIGNIFICANT_ACCURACY_DIFFERENCE_METERS;

  // Determine if location is newer
  const isNewer = timeDelta > 0;

  // Check if from same provider
  const isFromSameProvider = newLocation.provider === currentBest.provider;

  // Evaluate location quality based on accuracy and recency
  if (isMoreAccurate) {
    return true;
  }

  if (isNewer && !isLessAccurate) {
    return true;
  }

  if (isNewer && !isSignificantlyLessAccurate && isFromSameProvider) {
    return true;
  }

  return false;
}
