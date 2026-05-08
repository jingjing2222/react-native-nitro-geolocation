declare global {
  // The example app enables Rozenite geolocation devtools in debug builds.
  // Native E2E contract screens temporarily disable the JS fixture override.
  var __geolocationDevToolsEnabled: boolean | undefined;
}

/**
 * Runs an operation against the real native geolocation implementation.
 *
 * Example screens use Rozenite fixtures in debug builds. Wrap native contract
 * assertions with this helper when the test must bypass the JS devtools
 * override and exercise the platform path.
 *
 * @example
 * ```ts
 * const position = await runWithNativeGeolocation(() =>
 *   getCurrentPosition({ maximumAge: 0, timeout: 15000 })
 * );
 * ```
 *
 * @param {() => Promise<T>} operation - Async native geolocation operation to
 * run while the JS fixture override is disabled. The callback should contain
 * only the native call and immediate assertions that must bypass Rozenite's JS
 * fixture layer.
 * @returns {Promise<T>} A promise that resolves or rejects with the same value
 * as `operation`, after restoring the previous devtools override flag in a
 * `finally` block.
 */
export const runWithNativeGeolocation = async <T>(
  operation: () => Promise<T>
): Promise<T> => {
  const previousDevtoolsEnabled = globalThis.__geolocationDevToolsEnabled;
  globalThis.__geolocationDevToolsEnabled = false;

  try {
    return await operation();
  } finally {
    globalThis.__geolocationDevToolsEnabled = previousDevtoolsEnabled;
  }
};
