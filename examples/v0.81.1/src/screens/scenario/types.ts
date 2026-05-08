/**
 * Lifecycle state for one E2E scenario result.
 *
 * @example
 * ```ts
 * const status: ScenarioStatus = "running";
 * ```
 */
export type ScenarioStatus = "idle" | "running" | "passed" | "failed";

/**
 * User-visible result shown by `ResultBlock`.
 *
 * Keep the message short enough for Maestro screenshots and failure triage.
 *
 * @example
 * ```ts
 * const result: ScenarioResult = {
 *   status: "passed",
 *   message: "Native request resolved with Seoul fixture coordinates."
 * };
 * ```
 *
 * @property {ScenarioStatus} status - Current lifecycle state rendered by
 * `ResultBlock`.
 * @property {string} message - Short user-visible detail rendered by
 * `ResultBlock`.
 */
export type ScenarioResult = {
  /** Current lifecycle state for the scenario. */
  status: ScenarioStatus;
  /** Short user-visible message rendered by `ResultBlock`. */
  message: string;
};

/**
 * Normalized native geolocation error shape used by E2E screens.
 *
 * @example
 * ```ts
 * const error: CapturedLocationError = {
 *   code: 1,
 *   name: "PERMISSION_DENIED",
 *   message: "Location permission was denied."
 * };
 * ```
 *
 * @property {number} code - Numeric native `LocationErrorCode`, or
 * `INTERNAL_ERROR` when a caught value does not expose a numeric code.
 * @property {string} name - Human-readable name for `code`.
 * @property {string} message - Error message captured from the native
 * exception.
 */
export type CapturedLocationError = {
  /** Numeric native `LocationErrorCode`, or `INTERNAL_ERROR` fallback. */
  code: number;
  /** Human-readable name for `code`. */
  name: string;
  /** Error message captured from the native exception. */
  message: string;
};
