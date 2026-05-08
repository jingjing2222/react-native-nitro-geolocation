import {
  LocationErrorCode,
  getLocationErrorCodeName
} from "react-native-nitro-geolocation";
import type { CapturedLocationError } from "../types";

/**
 * Normalizes unknown native errors into the E2E error shape.
 *
 * Missing numeric codes are treated as `INTERNAL_ERROR` so screens can render a
 * stable code/name/message card.
 *
 * @example
 * ```ts
 * const error = captureLocationError(caught);
 * // { code: 1, name: "PERMISSION_DENIED", message: "..." }
 * ```
 *
 * @param {unknown} error - Unknown value caught from a native geolocation call.
 * If it has a numeric `code` property, that code is used; otherwise the helper
 * falls back to `LocationErrorCode.INTERNAL_ERROR`.
 * @returns {CapturedLocationError} Normalized location error with numeric
 * `code`, human-readable `name` from `getLocationErrorCodeName`, and a string
 * `message` suitable for rendering in scenario UI.
 */
export const captureLocationError = (error: unknown): CapturedLocationError => {
  const maybeError = error as { code?: unknown; message?: unknown };
  const code =
    typeof maybeError.code === "number"
      ? maybeError.code
      : LocationErrorCode.INTERNAL_ERROR;
  const message =
    typeof maybeError.message === "string" ? maybeError.message : String(error);

  return {
    code,
    name: getLocationErrorCodeName(code),
    message
  };
};

/**
 * Formats an unknown native error for result messages.
 *
 * @example
 * ```ts
 * setResult(
 *   "denied",
 *   createScenarioResult("failed", getDisplayErrorMessage(error))
 * );
 * ```
 *
 * @param {unknown} error - Unknown value caught from a native geolocation call.
 * The value is first normalized with `captureLocationError`.
 * @returns {string} User-visible `NAME: message` string for scenario result
 * messages, for example `PERMISSION_DENIED: Location permission was denied`.
 */
export const getDisplayErrorMessage = (error: unknown) => {
  const locationError = captureLocationError(error);

  return `${locationError.name}: ${locationError.message}`;
};

/**
 * Asserts that a caught native error has the expected `LocationErrorCode`.
 *
 * Returns the normalized error for pass messages and throws a descriptive
 * assertion error when the code differs.
 *
 * @example
 * ```ts
 * const locationError = assertLocationErrorCode(
 *   error,
 *   LocationErrorCode.PERMISSION_DENIED
 * );
 *
 * setResult(
 *   "denied",
 *   createScenarioResult("passed", `${locationError.name}: permission gate held.`)
 * );
 * ```
 *
 * @param {unknown} error - Unknown value caught from a native geolocation call.
 * The value is normalized before comparing codes.
 * @param {LocationErrorCode} expectedCode - Native `LocationErrorCode` expected
 * by the contract, such as `LocationErrorCode.PERMISSION_DENIED`.
 * @returns {CapturedLocationError} Normalized location error when its code
 * matches `expectedCode`; screens can reuse it in pass messages.
 * @throws {Error} Throws when the normalized code differs from `expectedCode`.
 */
export const assertLocationErrorCode = (
  error: unknown,
  expectedCode: LocationErrorCode
) => {
  const locationError = captureLocationError(error);

  if (locationError.code !== expectedCode) {
    throw new Error(
      `Expected ${getLocationErrorCodeName(
        expectedCode
      )}, received ${locationError.name}: ${locationError.message}`
    );
  }

  return locationError;
};
