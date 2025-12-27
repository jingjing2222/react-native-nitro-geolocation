/**
 * Validates whether a cached location is still fresh based on its age.
 *
 * @param timestampMs - The timestamp of the cached location (in milliseconds)
 * @param currentTimeMs - The current time (in milliseconds)
 * @param maximumAgeMs - The maximum age allowed for the cache (in milliseconds)
 * @returns true if the cache is still valid, false otherwise
 *
 * @example
 * ```ts
 * const timestampMs = Date.now() - 5000; // 5 seconds ago
 * const currentTimeMs = Date.now();
 * const maximumAgeMs = 10000; // 10 seconds
 *
 * isCachedLocationValid(timestampMs, currentTimeMs, maximumAgeMs); // true
 * ```
 */
export function isCachedLocationValid(
  timestampMs: number,
  currentTimeMs: number,
  maximumAgeMs: number
): boolean {
  const age = currentTimeMs - timestampMs;
  return age < maximumAgeMs;
}
