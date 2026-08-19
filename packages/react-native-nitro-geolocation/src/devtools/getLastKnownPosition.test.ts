import { afterEach, describe, expect, it } from "vitest";
import { getDevtoolsState } from ".";
import type { GeolocationResponse } from "../publicTypes";
import { getDevtoolsLastKnownPosition } from "./getLastKnownPosition";

const now = 1_779_015_190_000;
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
  timestamp: now - 5_000
};

afterEach(() => {
  getDevtoolsState().position = null;
});

describe("getDevtoolsLastKnownPosition", () => {
  it("returns undefined when DevTools has not observed a position", () => {
    expect(getDevtoolsLastKnownPosition(undefined, now)).toBeUndefined();
  });

  it("returns a DevTools position that satisfies maximumAge", () => {
    getDevtoolsState().position = position;

    expect(getDevtoolsLastKnownPosition({ maximumAge: 10_000 }, now)).toBe(
      position
    );
  });

  it("returns undefined when the DevTools position is stale", () => {
    getDevtoolsState().position = position;

    expect(
      getDevtoolsLastKnownPosition({ maximumAge: 1_000 }, now)
    ).toBeUndefined();
  });
});
