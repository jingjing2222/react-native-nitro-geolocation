import { describe, expect, it } from "vitest";
import { mergeConfigurations } from "./config";

describe("mergeConfigurations", () => {
  it("uses low-power defaults when there are no active requests", () => {
    expect(mergeConfigurations([])).toEqual({
      bestAccuracy: "low",
      smallestDistanceFilter: 0
    });
  });

  it("preserves a medium-only accuracy request", () => {
    expect(
      mergeConfigurations([{ accuracy: "medium", distanceFilter: 25 }])
    ).toEqual({
      bestAccuracy: "medium",
      smallestDistanceFilter: 25
    });
  });

  it("combines the highest accuracy with the smallest distance filter", () => {
    expect(
      mergeConfigurations([
        { accuracy: "low", distanceFilter: 100 },
        { accuracy: "high", distanceFilter: 50 },
        { accuracy: "medium", distanceFilter: 10 }
      ])
    ).toEqual({
      bestAccuracy: "high",
      smallestDistanceFilter: 10
    });
  });
});
