/**
 * Error codes for geolocation errors.
 * These codes match the W3C Geolocation API specification.
 */
export enum LocationErrorCode {
  /** User denied the request for Geolocation */
  PERMISSION_DENIED = 1,
  /** Location provider is unavailable */
  POSITION_UNAVAILABLE = 2,
  /** The request to get location timed out */
  TIMEOUT = 3,
}

/**
 * Geolocation error object.
 */
export interface LocationError extends Error {
  code: LocationErrorCode;
  message: string;
  PERMISSION_DENIED: LocationErrorCode.PERMISSION_DENIED;
  POSITION_UNAVAILABLE: LocationErrorCode.POSITION_UNAVAILABLE;
  TIMEOUT: LocationErrorCode.TIMEOUT;
}

/**
 * Creates a standardized LocationError object.
 *
 * @param code - The error code from LocationErrorCode enum
 * @param message - A human-readable error message
 * @returns A LocationError object
 *
 * @example
 * ```ts
 * const error = createLocationError(
 *   LocationErrorCode.PERMISSION_DENIED,
 *   'User denied location permission'
 * );
 * ```
 */
export function createLocationError(
  code: LocationErrorCode,
  message: string
): LocationError {
  const error = new Error(message) as LocationError;
  error.code = code;
  error.PERMISSION_DENIED = LocationErrorCode.PERMISSION_DENIED;
  error.POSITION_UNAVAILABLE = LocationErrorCode.POSITION_UNAVAILABLE;
  error.TIMEOUT = LocationErrorCode.TIMEOUT;
  return error;
}

/**
 * Maps iOS CLError codes to LocationErrorCode.
 *
 * @param clErrorCode - The iOS CLError code
 * @returns The corresponding LocationErrorCode
 *
 * @see https://developer.apple.com/documentation/corelocation/clerror/code
 */
export function mapCLErrorCode(clErrorCode: number): LocationErrorCode {
  switch (clErrorCode) {
    case 0: // kCLErrorDenied
      return LocationErrorCode.PERMISSION_DENIED;
    case 1: // kCLErrorLocationUnknown
      return LocationErrorCode.POSITION_UNAVAILABLE;
    default:
      return LocationErrorCode.POSITION_UNAVAILABLE;
  }
}

/**
 * Maps Android exception types to LocationErrorCode.
 *
 * @param exceptionType - The Android exception class name
 * @returns The corresponding LocationErrorCode
 */
export function mapAndroidException(exceptionType: string): LocationErrorCode {
  if (exceptionType === 'SecurityException') {
    return LocationErrorCode.PERMISSION_DENIED;
  }
  return LocationErrorCode.POSITION_UNAVAILABLE;
}
