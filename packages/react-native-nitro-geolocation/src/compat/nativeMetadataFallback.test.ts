import { afterEach, describe, expect, it, vi } from "vitest";

const compatObject = vi.hoisted(() => ({
  getCurrentPosition: vi.fn(),
  watchPosition: vi.fn()
}));

vi.mock("../NitroGeolocationModule", () => ({
  NitroGeolocationHybridCompatObject: compatObject
}));

import { getCurrentPosition } from "./getCurrentPosition";
import { watchPosition } from "./watchPosition";

const basePosition = {
  coords: {
    latitude: 37.5665,
    longitude: 126.978,
    altitude: null,
    accuracy: 11,
    altitudeAccuracy: null,
    heading: null,
    speed: null
  },
  timestamp: 1779015190000
};

afterEach(() => {
  compatObject.getCurrentPosition.mockReset();
  compatObject.watchPosition.mockReset();
});

describe("compat metadata on an older native binary", () => {
  it("falls back to the default current-position method", () => {
    compatObject.getCurrentPosition.mockImplementation((success) => {
      success(basePosition);
    });
    const success = vi.fn();

    getCurrentPosition(success, undefined, { includeExtraMetadata: true });

    expect(success).toHaveBeenCalledWith(basePosition);
    expect(Object.keys(success.mock.calls[0][0])).toEqual([
      "coords",
      "timestamp"
    ]);
  });

  it("falls back to the default watch method", () => {
    compatObject.watchPosition.mockImplementation((success) => {
      success(basePosition);
      return 73;
    });
    const success = vi.fn();

    const watchId = watchPosition(success, undefined, {
      includeExtraMetadata: true
    });

    expect(watchId).toBe(73);
    expect(success).toHaveBeenCalledWith(basePosition);
    expect(Object.keys(success.mock.calls[0][0])).toEqual([
      "coords",
      "timestamp"
    ]);
  });
});
