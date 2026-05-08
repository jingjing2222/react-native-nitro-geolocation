import { useCallback, useState } from "react";
import type { ScenarioResult } from "../types";

/**
 * Typed setter used by `useScenarioResults`.
 *
 * @example
 * ```ts
 * const setResult: SetScenarioResult<typeof results> = (key, result) => {
 *   console.log(key, result.status);
 * };
 * ```
 *
 * @param {keyof T} key - Known result key from the screen's typed result
 * record.
 * @param {ScenarioResult} result - New result state to store at `key`.
 * @returns {void} The setter mutates React state and does not return a value.
 */
export type SetScenarioResult<T extends Record<string, ScenarioResult>> = <
  K extends keyof T
>(
  key: K,
  result: ScenarioResult
) => void;

/**
 * Values returned by `useScenarioResults`.
 *
 * @example
 * ```ts
 * const state: UseScenarioResultsResult<typeof initialResults> =
 *   useScenarioResults(initialResults);
 * ```
 *
 * @property {T} results - Current typed result record for the screen.
 * @property {SetScenarioResult<T>} setResult - Typed setter that updates one
 * known result key while preserving the rest of the record.
 * @property {() => void} resetResults - Restores the result record to the
 * initial idle values.
 */
export type UseScenarioResultsResult<T extends Record<string, ScenarioResult>> =
  {
    /** Current typed result record for the screen. */
    results: T;
    /** Updates one known result key while preserving the rest of the record. */
    setResult: SetScenarioResult<T>;
    /** Restores the result record to the initial idle values. */
    resetResults: () => void;
  };

/**
 * Typed state helper for a screen's scenario result record.
 *
 * Pair it with `createScenarioResults([...])` so `setResult` only accepts known
 * result keys from that screen.
 *
 * @example
 * ```tsx
 * const initialResults = createScenarioResults(["positive", "denied"] as const);
 *
 * const { results, setResult } = useScenarioResults(initialResults);
 *
 * setResult(
 *   "positive",
 *   createScenarioResult("running", "Requesting a native position")
 * );
 * ```
 *
 * @param {T} initialResults - Typed initial result record for the screen,
 * usually created with `createScenarioResults([...])`. The literal keys in this
 * object become the only accepted keys for `setResult`.
 * @returns {UseScenarioResultsResult<T>} Result state helpers for the screen.
 * `results` is the current typed result record, `setResult(key, result)` updates
 * one known key while preserving the rest of the record, and `resetResults()`
 * restores the initial idle values.
 */
export function useScenarioResults<T extends Record<string, ScenarioResult>>(
  initialResults: T
): UseScenarioResultsResult<T> {
  const [results, setResults] = useState<T>(initialResults);

  const setResult = useCallback(
    <K extends keyof T>(key: K, result: ScenarioResult) => {
      setResults(
        (previous) =>
          ({
            ...previous,
            [key]: result
          }) as T
      );
    },
    []
  );

  const resetResults = useCallback(() => {
    setResults(initialResults);
  }, [initialResults]);

  return {
    results,
    setResult,
    resetResults
  };
}
