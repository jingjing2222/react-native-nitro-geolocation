export type LocationErrorCode =
  | "internalError"
  | "permissionDenied"
  | "positionUnavailable"
  | "timeout"
  | "playServicesUnavailable"
  | "settingsNotSatisfied";

/**
 * Readable Modern API error codes.
 *
 * `/compat` keeps the W3C numeric codes. The Modern API uses these string
 * discriminants so logs and serialized errors remain meaningful without a
 * numeric lookup table.
 */
export const LocationErrorCodes = {
  /** Unexpected module/native failure */
  INTERNAL_ERROR: "internalError",
  /** User denied the request for Geolocation */
  PERMISSION_DENIED: "permissionDenied",
  /** Location provider is unavailable */
  POSITION_UNAVAILABLE: "positionUnavailable",
  /** The request to get location timed out */
  TIMEOUT: "timeout",
  /** Android Google Play Services provider is unavailable */
  PLAY_SERVICE_NOT_AVAILABLE: "playServicesUnavailable",
  /** Device/provider settings do not satisfy the request */
  SETTINGS_NOT_SATISFIED: "settingsNotSatisfied"
} as const satisfies Record<string, LocationErrorCode>;

/**
 * Geolocation error object.
 */
export interface LocationError {
  code: LocationErrorCode;
  message: string;
}

const locationErrorCodes = new Set<LocationErrorCode>(
  Object.values(LocationErrorCodes)
);

const locationErrorCodeNames: Record<LocationErrorCode, string> = {
  [LocationErrorCodes.INTERNAL_ERROR]: "INTERNAL_ERROR",
  [LocationErrorCodes.PERMISSION_DENIED]: "PERMISSION_DENIED",
  [LocationErrorCodes.POSITION_UNAVAILABLE]: "POSITION_UNAVAILABLE",
  [LocationErrorCodes.TIMEOUT]: "TIMEOUT",
  [LocationErrorCodes.PLAY_SERVICE_NOT_AVAILABLE]: "PLAY_SERVICE_NOT_AVAILABLE",
  [LocationErrorCodes.SETTINGS_NOT_SATISFIED]: "SETTINGS_NOT_SATISFIED"
};

/**
 * Creates a standardized LocationError object.
 *
 * @param code - A Modern API location error code
 * @param message - A human-readable error message
 * @returns A LocationError object
 *
 * @example
 * ```ts
 * const error = createLocationError(
 *   LocationErrorCodes.PERMISSION_DENIED,
 *   'User denied location permission'
 * );
 * ```
 */
export function createLocationError(
  code: LocationErrorCode,
  message: string
): LocationError {
  return { code, message };
}

export function isLocationErrorCode(
  value: unknown
): value is LocationErrorCode {
  return (
    typeof value === "string" &&
    locationErrorCodes.has(value as LocationErrorCode)
  );
}

export function getLocationErrorCodeName(code: unknown): string {
  return (
    locationErrorCodeNames[code as LocationErrorCode] ??
    "UNKNOWN_LOCATION_ERROR"
  );
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
    case 0: // kCLErrorLocationUnknown
      return LocationErrorCodes.POSITION_UNAVAILABLE;
    case 1: // kCLErrorDenied
      return LocationErrorCodes.PERMISSION_DENIED;
    default:
      return LocationErrorCodes.POSITION_UNAVAILABLE;
  }
}

/**
 * Maps Android exception types to LocationErrorCode.
 *
 * @param exceptionType - The Android exception class name
 * @returns The corresponding LocationErrorCode
 */
export function mapAndroidException(exceptionType: string): LocationErrorCode {
  if (exceptionType === "SecurityException") {
    return LocationErrorCodes.PERMISSION_DENIED;
  }
  if (
    exceptionType === "GooglePlayServicesNotAvailableException" ||
    exceptionType === "GooglePlayServicesRepairableException"
  ) {
    return LocationErrorCodes.PLAY_SERVICE_NOT_AVAILABLE;
  }
  if (
    exceptionType === "ResolvableApiException" ||
    exceptionType === "LocationSettingsException"
  ) {
    return LocationErrorCodes.SETTINGS_NOT_SATISFIED;
  }
  return LocationErrorCodes.POSITION_UNAVAILABLE;
}
