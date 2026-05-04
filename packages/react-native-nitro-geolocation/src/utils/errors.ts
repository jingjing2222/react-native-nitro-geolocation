/**
 * Error codes for geolocation errors.
 * Codes 1-3 match the W3C Geolocation API specification. Modern API also
 * exposes native location-provider/setup failures that cannot be represented
 * by the legacy browser contract.
 */
export enum LocationErrorCode {
  /** Unexpected module/native failure */
  INTERNAL_ERROR = -1,
  /** User denied the request for Geolocation */
  PERMISSION_DENIED = 1,
  /** Location provider is unavailable */
  POSITION_UNAVAILABLE = 2,
  /** The request to get location timed out */
  TIMEOUT = 3,
  /** Android Google Play Services provider is unavailable */
  PLAY_SERVICE_NOT_AVAILABLE = 4,
  /** Device/provider settings do not satisfy the request */
  SETTINGS_NOT_SATISFIED = 5
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
  PLAY_SERVICE_NOT_AVAILABLE: LocationErrorCode.PLAY_SERVICE_NOT_AVAILABLE;
  SETTINGS_NOT_SATISFIED: LocationErrorCode.SETTINGS_NOT_SATISFIED;
  INTERNAL_ERROR: LocationErrorCode.INTERNAL_ERROR;
}

const LOCATION_ERROR_PREFIX = "NitroGeolocationError";

const locationErrorCodeNames: Record<LocationErrorCode, string> = {
  [LocationErrorCode.INTERNAL_ERROR]: "INTERNAL_ERROR",
  [LocationErrorCode.PERMISSION_DENIED]: "PERMISSION_DENIED",
  [LocationErrorCode.POSITION_UNAVAILABLE]: "POSITION_UNAVAILABLE",
  [LocationErrorCode.TIMEOUT]: "TIMEOUT",
  [LocationErrorCode.PLAY_SERVICE_NOT_AVAILABLE]: "PLAY_SERVICE_NOT_AVAILABLE",
  [LocationErrorCode.SETTINGS_NOT_SATISFIED]: "SETTINGS_NOT_SATISFIED"
};

const knownLocationErrorCodes = new Set<number>(
  Object.values(LocationErrorCode).filter(
    (value): value is number => typeof value === "number"
  )
);

function normalizeCode(code: unknown): LocationErrorCode | null {
  if (typeof code !== "number" || !knownLocationErrorCodes.has(code)) {
    return null;
  }
  return code as LocationErrorCode;
}

function getRawMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return String(error);
}

function parseEncodedLocationError(message: string): {
  code: LocationErrorCode | null;
  message: string;
} {
  const match = message.match(
    new RegExp(`${LOCATION_ERROR_PREFIX}\\(code=(-?\\d+)\\):\\s*([\\s\\S]*)$`)
  );

  if (!match) {
    return {
      code: null,
      message
    };
  }

  return {
    code: normalizeCode(Number(match[1])),
    message: match[2] || message
  };
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
  error.name = "LocationError";
  error.code = code;
  error.PERMISSION_DENIED = LocationErrorCode.PERMISSION_DENIED;
  error.POSITION_UNAVAILABLE = LocationErrorCode.POSITION_UNAVAILABLE;
  error.TIMEOUT = LocationErrorCode.TIMEOUT;
  error.PLAY_SERVICE_NOT_AVAILABLE =
    LocationErrorCode.PLAY_SERVICE_NOT_AVAILABLE;
  error.SETTINGS_NOT_SATISFIED = LocationErrorCode.SETTINGS_NOT_SATISFIED;
  error.INTERNAL_ERROR = LocationErrorCode.INTERNAL_ERROR;
  return error;
}

export function getLocationErrorCodeName(code: number): string {
  return (
    locationErrorCodeNames[code as LocationErrorCode] ??
    "UNKNOWN_LOCATION_ERROR"
  );
}

export function normalizeLocationError(error: unknown): LocationError {
  const rawCode = normalizeCode(
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : null
  );
  const nestedCode = normalizeCode(
    typeof error === "object" &&
      error !== null &&
      "locationError" in error &&
      typeof error.locationError === "object" &&
      error.locationError !== null &&
      "code" in error.locationError
      ? error.locationError.code
      : null
  );
  const rawMessage = getRawMessage(error);
  const encoded = parseEncodedLocationError(rawMessage);
  const message = encoded.message;
  // Native owns the semantic code. JS only preserves structured callback errors
  // and decodes native promise errors flattened by the bridge.
  const code =
    rawCode ?? nestedCode ?? encoded.code ?? LocationErrorCode.INTERNAL_ERROR;

  return createLocationError(code, message);
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
      return LocationErrorCode.POSITION_UNAVAILABLE;
    case 1: // kCLErrorDenied
      return LocationErrorCode.PERMISSION_DENIED;
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
  if (exceptionType === "SecurityException") {
    return LocationErrorCode.PERMISSION_DENIED;
  }
  if (
    exceptionType === "GooglePlayServicesNotAvailableException" ||
    exceptionType === "GooglePlayServicesRepairableException"
  ) {
    return LocationErrorCode.PLAY_SERVICE_NOT_AVAILABLE;
  }
  if (
    exceptionType === "ResolvableApiException" ||
    exceptionType === "LocationSettingsException"
  ) {
    return LocationErrorCode.SETTINGS_NOT_SATISFIED;
  }
  return LocationErrorCode.POSITION_UNAVAILABLE;
}
