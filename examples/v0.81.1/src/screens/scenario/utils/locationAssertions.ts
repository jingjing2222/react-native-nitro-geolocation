import type {
  AccuracyAuthorization,
  GeolocationResponse
} from "react-native-nitro-geolocation";

/**
 * Shared fixture coordinates used by Maestro location injection.
 *
 * Keep this in sync with the `.maestro` flows that call `setLocation`.
 *
 * @example
 * ```ts
 * await reverseGeocode(SEOUL_FIXTURE);
 * ```
 *
 * @property {number} latitude - Latitude injected by Maestro for the shared
 * Seoul fixture.
 * @property {number} longitude - Longitude injected by Maestro for the shared
 * Seoul fixture.
 */
export const SEOUL_FIXTURE = {
  latitude: 37.5665,
  longitude: 126.978
};

const DEFAULT_COORDINATE_TOLERANCE = 0.02;

/**
 * Options for fixture coordinate assertions.
 *
 * Use the default tolerance for precise fixture checks. Pass a larger
 * tolerance only for platform paths that intentionally return approximate
 * coordinates, such as Android coarse granularity.
 *
 * @example
 * ```ts
 * assertFixtureCoordinates(position, {
 *   coordinateTolerance: 0.03
 * });
 * ```
 *
 * @property {number} [coordinateTolerance = 0.02] - Maximum accepted absolute
 * latitude and longitude delta from `SEOUL_FIXTURE`, measured in decimal
 * degrees. The default keeps precise fixture assertions tight; Android coarse
 * results can opt into a wider value.
 */
export type FixtureCoordinateOptions = {
  coordinateTolerance?: number;
};

/**
 * Error thrown when a native position is finite but not close to the fixture.
 *
 * Some screens retry on this error because simulators can briefly return an
 * older provider location before the Maestro fixture settles.
 *
 * @example
 * ```ts
 * try {
 *   assertFixtureCoordinates(position);
 * } catch (error) {
 *   if (error instanceof FixtureMismatchError) {
 *     // Retry until the injected fixture settles.
 *   }
 * }
 * ```
 */
export class FixtureMismatchError extends Error {
  /**
   * @param {string} message - Human-readable mismatch detail used by retry
   * loops and failed scenario result messages.
   */
  constructor(message: string) {
    super(message);
    this.name = "FixtureMismatchError";
    Object.setPrototypeOf(this, FixtureMismatchError.prototype);
  }
}

/**
 * Validates that a geolocation response matches the shared Seoul fixture.
 *
 * Throws on non-finite coordinates or coordinates outside the allowed
 * tolerance. Returns a formatted coordinate summary for result messages.
 *
 * @example
 * ```ts
 * const coordinates = assertFixtureCoordinates(position);
 *
 * setResult(
 *   "current",
 *   createScenarioResult("passed", `Received ${coordinates}.`)
 * );
 * ```
 *
 * @param {GeolocationResponse} position - Native geolocation response to
 * validate against `SEOUL_FIXTURE`. The helper reads
 * `position.coords.latitude` and `position.coords.longitude`.
 * @param {FixtureCoordinateOptions} [options] - Optional assertion settings
 * for scenarios that need a platform-specific fixture tolerance.
 * @returns {string} Formatted `latitude, longitude` summary for pass messages,
 * with both values rounded to six decimal places.
 * @throws {Error} Throws when either coordinate is not a finite number.
 * @throws {FixtureMismatchError} Throws when finite coordinates do not match
 * the shared fixture within tolerance.
 */
export const assertFixtureCoordinates = (
  position: GeolocationResponse,
  options: FixtureCoordinateOptions = {}
) => {
  const coordinateTolerance =
    options.coordinateTolerance ?? DEFAULT_COORDINATE_TOLERANCE;
  const latitudeDelta = Math.abs(
    position.coords.latitude - SEOUL_FIXTURE.latitude
  );
  const longitudeDelta = Math.abs(
    position.coords.longitude - SEOUL_FIXTURE.longitude
  );

  if (
    !Number.isFinite(position.coords.latitude) ||
    !Number.isFinite(position.coords.longitude)
  ) {
    throw new Error("Position contained non-finite coordinates.");
  }

  if (
    latitudeDelta > coordinateTolerance ||
    longitudeDelta > coordinateTolerance
  ) {
    throw new FixtureMismatchError(
      `Position did not match fixture: ${position.coords.latitude.toFixed(
        6
      )}, ${position.coords.longitude.toFixed(6)}.`
    );
  }

  return `${position.coords.latitude.toFixed(
    6
  )}, ${position.coords.longitude.toFixed(6)}`;
};

/**
 * Validates that an iOS accuracy authorization value is one of the known enum
 * values exposed by the native module.
 *
 * @example
 * ```ts
 * const authorization = assertKnownAccuracyAuthorization(
 *   await getAccuracyAuthorization()
 * );
 * ```
 *
 * @param {AccuracyAuthorization} authorization - Accuracy authorization value
 * returned by the native module.
 * @returns {AccuracyAuthorization} The same authorization value when it is one
 * of the known enum values: `full`, `reduced`, or `unknown`.
 * @throws {Error} Throws when the value is outside the known native enum
 * contract.
 */
export const assertKnownAccuracyAuthorization = (
  authorization: AccuracyAuthorization
) => {
  if (!["full", "reduced", "unknown"].includes(authorization)) {
    throw new Error(`Unexpected accuracy authorization: ${authorization}`);
  }

  return authorization;
};

/**
 * Validates that an iOS accuracy authorization value represents granted
 * location access.
 *
 * @example
 * ```ts
 * const authorization = assertGrantedAccuracyAuthorization(
 *   await requestTemporaryFullAccuracy("PreciseE2E")
 * );
 * ```
 *
 * @param {AccuracyAuthorization} authorization - Accuracy authorization value
 * returned by the native module.
 * @returns {AccuracyAuthorization} The same authorization value when it
 * represents granted location access, currently `full` or `reduced`.
 * @throws {Error} Throws when the value is `unknown` or outside the granted
 * contract.
 */
export const assertGrantedAccuracyAuthorization = (
  authorization: AccuracyAuthorization
) => {
  if (!["full", "reduced"].includes(authorization)) {
    throw new Error(
      `Expected full or reduced accuracy authorization, received ${authorization}`
    );
  }

  return authorization;
};
