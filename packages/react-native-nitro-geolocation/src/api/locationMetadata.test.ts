import { describe, expect, it } from "vitest";
import type { GeolocationResponse } from "../publicTypes";
import { decoratePositionWithMetadata } from "./locationMetadata";

const createPosition = (
  accuracy: number,
  timestamp: number
): GeolocationResponse => ({
  coords: {
    latitude: 37.5665,
    longitude: 126.978,
    altitude: null,
    accuracy,
    altitudeAccuracy: null,
    heading: null,
    speed: null
  },
  timestamp
});

describe("location response metadata", () => {
  it("describes a current-position result without mutating the native response", () => {
    const position = createPosition(5, 9_500);

    const result = decoratePositionWithMetadata(position, {
      source: "currentPosition",
      maximumAge: 1_000,
      requestedAt: 9_000,
      observedAt: 10_000
    });

    expect(result).not.toBe(position);
    expect(position).not.toHaveProperty("metadata");
    expect(result).toMatchObject({
      metadata: {
        source: "currentPosition",
        age: 500,
        quality: "high"
      }
    });
    expect(result.metadata).not.toHaveProperty("staleReason");
  });

  it.each([
    [0, "unknown"],
    [10, "high"],
    [10.01, "medium"],
    [100, "medium"],
    [100.01, "low"],
    [-1, "unknown"],
    [Number.POSITIVE_INFINITY, "unknown"]
  ] as const)("classifies %s metre accuracy as %s", (accuracy, quality) => {
    expect(
      decoratePositionWithMetadata(createPosition(accuracy, 10_000), {
        source: "watchPosition",
        observedAt: 10_000
      }).metadata?.quality
    ).toBe(quality);
  });

  it("reports a provider result that violates maximumAge without rejecting it", () => {
    const result = decoratePositionWithMetadata(createPosition(25, 5_000), {
      source: "currentPosition",
      maximumAge: 2_000,
      requestedAt: 8_000,
      observedAt: 9_000
    });

    expect(result.coords.latitude).toBe(37.5665);
    expect(result.metadata?.age).toBe(4_000);
    expect(result.metadata?.staleReason).toBe("maximumAgeExceeded");
  });

  it("does not label a fresh maximumAge zero result as stale", () => {
    const result = decoratePositionWithMetadata(createPosition(25, 8_000), {
      source: "currentPosition",
      maximumAge: 0,
      requestedAt: 8_000,
      observedAt: 8_100
    });

    expect(result.metadata?.age).toBe(100);
    expect(result.metadata).not.toHaveProperty("staleReason");
  });

  it("recomputes delivery metadata instead of carrying an earlier stale reason", () => {
    const stale = decoratePositionWithMetadata(createPosition(25, 5_000), {
      source: "currentPosition",
      maximumAge: 2_000,
      requestedAt: 8_000,
      observedAt: 9_000
    });
    const cached = decoratePositionWithMetadata(stale, {
      source: "moduleCache",
      observedAt: 10_000
    });

    expect(stale.metadata?.staleReason).toBe("maximumAgeExceeded");
    expect(cached.metadata).not.toHaveProperty("staleReason");
  });

  it("tolerates sub-millisecond clock precision without hiding future timestamps", () => {
    const withinClockResolution = decoratePositionWithMetadata(
      createPosition(25, 10_000.5),
      {
        source: "platformCache",
        observedAt: 10_000
      }
    );
    const future = decoratePositionWithMetadata(createPosition(25, 10_002), {
      source: "platformCache",
      observedAt: 10_000
    });
    const invalid = decoratePositionWithMetadata(
      createPosition(25, Number.NaN),
      {
        source: "platformCache",
        observedAt: 10_000
      }
    );

    expect(withinClockResolution.metadata?.age).toBe(0);
    expect(withinClockResolution.metadata).not.toHaveProperty("staleReason");
    expect(future.metadata?.age).toBe(0);
    expect(future.metadata?.staleReason).toBe("futureTimestamp");
    expect(invalid.metadata).not.toHaveProperty("age");
    expect(invalid.metadata?.staleReason).toBe("invalidTimestamp");
  });
});
