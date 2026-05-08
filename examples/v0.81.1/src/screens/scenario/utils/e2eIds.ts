/**
 * Builds stable Maestro-friendly testIDs from a screen prefix and parts.
 *
 * `null`, `undefined`, and `false` parts are skipped so callers can include
 * conditional segments without manual branching.
 *
 * @example
 * ```ts
 * createE2EId("heading", "current", "result");
 * // "heading-current-result"
 *
 * createE2EId("provider", false, "status");
 * // "provider-status"
 * ```
 *
 * @param {string} prefix - Required first testID segment, usually the screen
 * prefix such as `heading` or `android-request-options`.
 * @param {...(string | number | null | undefined | false)} parts - Optional
 * testID segments appended after `prefix`. `null`, `undefined`, and `false`
 * values are ignored so callers can pass conditional segments without manual
 * branching.
 * @returns {string} Hyphen-joined testID suitable for React Native and Maestro,
 * for example `heading-current-result`.
 */
export const createE2EId = (
  prefix: string,
  ...parts: Array<string | number | null | undefined | false>
) => {
  return [prefix, ...parts.filter((part) => part !== false && part != null)]
    .map(String)
    .join("-");
};
