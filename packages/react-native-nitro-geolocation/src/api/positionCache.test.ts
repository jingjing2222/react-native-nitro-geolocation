import { afterEach, describe, expect, it } from "vitest";
import type { GeolocationResponse } from "../publicTypes";
import {
  clearLastKnownPositionCache,
  readLastKnownPosition,
  rememberPosition,
  selectCachedPosition
} from "./positionCache";

const position: GeolocationResponse = {
  coords: {
    latitude: 37.5665,
    longitude: 126.978,
    altitude: null,
    accuracy: 10,
    altitudeAccuracy: null,
    heading: null,
    speed: null
  },
  timestamp: 1_779_015_190_000
};

afterEach(() => clearLastKnownPositionCache());

describe("positionCache", () => {
  it("returns undefined before this module observes a position", () => {
    expect(readLastKnownPosition()).toBeUndefined();
  });

  it("returns the latest observed position synchronously", () => {
    expect(rememberPosition(position)).toBe(position);
    expect(readLastKnownPosition()).toBe(position);
  });

  it("selects only positions within maximumAge", () => {
    expect(
      selectCachedPosition(position, 10_000, position.timestamp + 5_000)
    ).toBe(position);
    expect(
      selectCachedPosition(position, 1_000, position.timestamp + 5_000)
    ).toBeUndefined();
    expect(
      selectCachedPosition(position, 0, position.timestamp)
    ).toBeUndefined();
  });

  it("accepts any observed age when maximumAge is infinite", () => {
    expect(
      selectCachedPosition(position, Number.POSITIVE_INFINITY, Number.MAX_VALUE)
    ).toBe(position);
  });
});
