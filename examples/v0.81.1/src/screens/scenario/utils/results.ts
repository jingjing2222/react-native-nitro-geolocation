import type { ScenarioResult, ScenarioStatus } from "../types";

/**
 * Creates the default "not run" result for a scenario.
 *
 * Prefer `createScenarioResults` for whole screens.
 *
 * @example
 * ```ts
 * const initial = createIdleResult();
 * // { status: "idle", message: "Not run" }
 * ```
 *
 * @returns {ScenarioResult} A new idle scenario result with
 * `status: "idle"` and `message: "Not run"`.
 */
export const createIdleResult = (): ScenarioResult => ({
  status: "idle",
  message: "Not run"
});

/**
 * Creates one user-visible scenario result.
 *
 * Use this instead of inline objects when setting running/passed/failed state
 * so screens stay visually consistent.
 *
 * @example
 * ```ts
 * setResult(
 *   "current",
 *   createScenarioResult("running", "Requesting one native reading")
 * );
 * ```
 *
 * @param {ScenarioStatus} status - Lifecycle state to render in `ResultBlock`.
 * Use `running` before starting an async native request, `passed` after the
 * contract assertion succeeds, and `failed` when the scenario catches an
 * unexpected native error or assertion failure.
 * @param {string} message - User-visible status detail rendered in the
 * `ResultBlock` message row. Keep it short enough for E2E screenshots and
 * failure triage.
 * @returns {ScenarioResult} A scenario result object ready to pass to
 * `setResult`.
 */
export const createScenarioResult = (
  status: ScenarioStatus,
  message: string
): ScenarioResult => ({
  status,
  message
});

/**
 * Creates a typed record of idle results for a screen.
 *
 * The returned keys are inferred from the literal ids, which lets
 * `useScenarioResults` reject unknown result keys.
 *
 * @example
 * ```ts
 * const initialResults = createScenarioResults([
 *   "current",
 *   "watch",
 *   "denied"
 * ] as const);
 * ```
 *
 * @param {readonly T[]} ids - Literal result keys for the screen. Pass the
 * array with `as const` so TypeScript preserves each key and
 * `useScenarioResults` can reject unknown result names.
 * @returns {Record<T, ScenarioResult>} A typed result record where every key
 * starts as `createIdleResult()`.
 */
export const createScenarioResults = <T extends string>(
  ids: readonly T[]
): Record<T, ScenarioResult> => {
  return ids.reduce(
    (results, id) => {
      results[id] = createIdleResult();
      return results;
    },
    {} as Record<T, ScenarioResult>
  );
};
