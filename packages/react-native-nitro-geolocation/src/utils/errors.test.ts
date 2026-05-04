import { describe, expect, it } from "vitest";
import {
  LocationErrorCode,
  createLocationError,
  encodeLocationErrorMessage,
  getLocationErrorCodeName,
  mapAndroidException,
  mapCLErrorCode,
  normalizeLocationError
} from "./errors";

describe("LocationErrorCode", () => {
  it("keeps legacy-compatible codes and adds modern-only error codes", () => {
    expect(LocationErrorCode.INTERNAL_ERROR).toBe(-1);
    expect(LocationErrorCode.PERMISSION_DENIED).toBe(1);
    expect(LocationErrorCode.POSITION_UNAVAILABLE).toBe(2);
    expect(LocationErrorCode.TIMEOUT).toBe(3);
    expect(LocationErrorCode.PLAY_SERVICE_NOT_AVAILABLE).toBe(4);
    expect(LocationErrorCode.SETTINGS_NOT_SATISFIED).toBe(5);
  });

  it("adds all constants to created LocationError objects", () => {
    const error = createLocationError(
      LocationErrorCode.SETTINGS_NOT_SATISFIED,
      "Location settings are disabled"
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("LocationError");
    expect(error.code).toBe(LocationErrorCode.SETTINGS_NOT_SATISFIED);
    expect(error.PERMISSION_DENIED).toBe(LocationErrorCode.PERMISSION_DENIED);
    expect(error.POSITION_UNAVAILABLE).toBe(
      LocationErrorCode.POSITION_UNAVAILABLE
    );
    expect(error.TIMEOUT).toBe(LocationErrorCode.TIMEOUT);
    expect(error.PLAY_SERVICE_NOT_AVAILABLE).toBe(
      LocationErrorCode.PLAY_SERVICE_NOT_AVAILABLE
    );
    expect(error.SETTINGS_NOT_SATISFIED).toBe(
      LocationErrorCode.SETTINGS_NOT_SATISFIED
    );
    expect(error.INTERNAL_ERROR).toBe(LocationErrorCode.INTERNAL_ERROR);
  });

  it("normalizes encoded native promise errors without leaking the code prefix", () => {
    const error = normalizeLocationError(
      new Error(
        encodeLocationErrorMessage(
          LocationErrorCode.TIMEOUT,
          "Unable to fetch location within 0.0s."
        )
      )
    );

    expect(error.code).toBe(LocationErrorCode.TIMEOUT);
    expect(error.message).toBe("Unable to fetch location within 0.0s.");
  });

  it("normalizes encoded native errors even when the bridge prepends context", () => {
    const error = normalizeLocationError(
      new Error(
        `NativeException: ${encodeLocationErrorMessage(
          LocationErrorCode.SETTINGS_NOT_SATISFIED,
          "Location services disabled."
        )}`
      )
    );

    expect(error.code).toBe(LocationErrorCode.SETTINGS_NOT_SATISFIED);
    expect(error.message).toBe("Location services disabled.");
  });

  it("infers setup and provider errors from native messages", () => {
    expect(
      normalizeLocationError(new Error("No activity available")).code
    ).toBe(LocationErrorCode.INTERNAL_ERROR);
    expect(
      normalizeLocationError(new Error("No location provider available")).code
    ).toBe(LocationErrorCode.SETTINGS_NOT_SATISFIED);
    expect(
      normalizeLocationError(
        new Error("Google Play Services location provider is not available.")
      ).code
    ).toBe(LocationErrorCode.PLAY_SERVICE_NOT_AVAILABLE);
  });

  it("maps platform-specific error sources", () => {
    expect(mapCLErrorCode(0)).toBe(LocationErrorCode.POSITION_UNAVAILABLE);
    expect(mapCLErrorCode(1)).toBe(LocationErrorCode.PERMISSION_DENIED);
    expect(mapAndroidException("SecurityException")).toBe(
      LocationErrorCode.PERMISSION_DENIED
    );
    expect(mapAndroidException("ResolvableApiException")).toBe(
      LocationErrorCode.SETTINGS_NOT_SATISFIED
    );
    expect(mapAndroidException("GooglePlayServicesNotAvailableException")).toBe(
      LocationErrorCode.PLAY_SERVICE_NOT_AVAILABLE
    );
  });

  it("returns stable names for code display", () => {
    expect(getLocationErrorCodeName(LocationErrorCode.INTERNAL_ERROR)).toBe(
      "INTERNAL_ERROR"
    );
    expect(getLocationErrorCodeName(LocationErrorCode.PERMISSION_DENIED)).toBe(
      "PERMISSION_DENIED"
    );
    expect(
      getLocationErrorCodeName(LocationErrorCode.POSITION_UNAVAILABLE)
    ).toBe("POSITION_UNAVAILABLE");
    expect(getLocationErrorCodeName(LocationErrorCode.TIMEOUT)).toBe("TIMEOUT");
    expect(
      getLocationErrorCodeName(LocationErrorCode.PLAY_SERVICE_NOT_AVAILABLE)
    ).toBe("PLAY_SERVICE_NOT_AVAILABLE");
    expect(
      getLocationErrorCodeName(LocationErrorCode.SETTINGS_NOT_SATISFIED)
    ).toBe("SETTINGS_NOT_SATISFIED");
    expect(getLocationErrorCodeName(999)).toBe("UNKNOWN_LOCATION_ERROR");
  });
});
