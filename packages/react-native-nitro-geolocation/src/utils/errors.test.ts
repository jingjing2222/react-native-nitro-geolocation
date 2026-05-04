import { describe, expect, it } from "vitest";
import {
  LocationErrorCode,
  createLocationError,
  getLocationErrorCodeName,
  mapAndroidException,
  mapCLErrorCode
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

  it("creates the same plain LocationError shape native sends to JS", () => {
    const error = createLocationError(
      LocationErrorCode.SETTINGS_NOT_SATISFIED,
      "Location settings are disabled"
    );

    expect(error).toEqual({
      code: LocationErrorCode.SETTINGS_NOT_SATISFIED,
      message: "Location settings are disabled"
    });
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
