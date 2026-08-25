import type { LocationRequestOptions } from "../publicTypes";

/** Options for a one-shot location request. */
export interface CurrentPositionOptions
  extends Omit<LocationRequestOptions, "maxUpdates"> {
  /**
   * Cancels only this request. A pre-aborted signal does not start native or
   * browser location work. Cancellation rejects with `signal.reason`, or an
   * `AbortError` when the runtime does not expose a reason.
   */
  signal?: AbortSignal;
}

export function getAbortReason(signal: AbortSignal): unknown {
  const reason = (signal as AbortSignal & { reason?: unknown }).reason;
  if (reason !== undefined) {
    return reason;
  }

  const error = new Error("The location request was aborted.");
  error.name = "AbortError";
  return error;
}

export function getNativeCurrentPositionOptions(
  options?: CurrentPositionOptions
): LocationRequestOptions {
  if (!options) {
    return {};
  }

  const { signal: _signal, ...nativeOptions } = options;
  return nativeOptions;
}
