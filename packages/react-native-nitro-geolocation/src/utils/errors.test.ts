import { describe, expect, it } from "vitest";
import {
  LocationErrorCodes,
  createLocationError,
  getLocationErrorCodeName,
  isLocationErrorCode,
  mapAndroidException,
  mapCLErrorCode
} from "./errors";

describe("LocationErrorCodes", () => {
  it("uses readable, platform-independent string codes", () => {
    expect(LocationErrorCodes.INTERNAL_ERROR).toBe("internalError");
    expect(LocationErrorCodes.PERMISSION_DENIED).toBe("permissionDenied");
    expect(LocationErrorCodes.POSITION_UNAVAILABLE).toBe("positionUnavailable");
    expect(LocationErrorCodes.TIMEOUT).toBe("timeout");
    expect(LocationErrorCodes.PLAY_SERVICE_NOT_AVAILABLE).toBe(
      "playServicesUnavailable"
    );
    expect(LocationErrorCodes.SETTINGS_NOT_SATISFIED).toBe(
      "settingsNotSatisfied"
    );
  });

  it("creates the same plain LocationError shape native sends to JS", () => {
    const error = createLocationError(
      LocationErrorCodes.SETTINGS_NOT_SATISFIED,
      "Location settings are disabled"
    );

    expect(error).toEqual({
      code: LocationErrorCodes.SETTINGS_NOT_SATISFIED,
      message: "Location settings are disabled"
    });
  });

  it("maps platform-specific error sources", () => {
    expect(mapCLErrorCode(0)).toBe(LocationErrorCodes.POSITION_UNAVAILABLE);
    expect(mapCLErrorCode(1)).toBe(LocationErrorCodes.PERMISSION_DENIED);
    expect(mapAndroidException("SecurityException")).toBe(
      LocationErrorCodes.PERMISSION_DENIED
    );
    expect(mapAndroidException("ResolvableApiException")).toBe(
      LocationErrorCodes.SETTINGS_NOT_SATISFIED
    );
    expect(mapAndroidException("GooglePlayServicesNotAvailableException")).toBe(
      LocationErrorCodes.PLAY_SERVICE_NOT_AVAILABLE
    );
  });

  it("returns stable names for known codes and rejects legacy numbers", () => {
    expect(getLocationErrorCodeName(LocationErrorCodes.INTERNAL_ERROR)).toBe(
      "INTERNAL_ERROR"
    );
    expect(getLocationErrorCodeName(LocationErrorCodes.PERMISSION_DENIED)).toBe(
      "PERMISSION_DENIED"
    );
    expect(
      getLocationErrorCodeName(LocationErrorCodes.POSITION_UNAVAILABLE)
    ).toBe("POSITION_UNAVAILABLE");
    expect(getLocationErrorCodeName(LocationErrorCodes.TIMEOUT)).toBe(
      "TIMEOUT"
    );
    expect(
      getLocationErrorCodeName(LocationErrorCodes.PLAY_SERVICE_NOT_AVAILABLE)
    ).toBe("PLAY_SERVICE_NOT_AVAILABLE");
    expect(
      getLocationErrorCodeName(LocationErrorCodes.SETTINGS_NOT_SATISFIED)
    ).toBe("SETTINGS_NOT_SATISFIED");
    expect(getLocationErrorCodeName(1)).toBe("UNKNOWN_LOCATION_ERROR");
  });

  it("accepts only known string discriminants", () => {
    expect(isLocationErrorCode("timeout")).toBe(true);
    expect(isLocationErrorCode("madeUpFailure")).toBe(false);
    expect(isLocationErrorCode(3)).toBe(false);
  });
});
