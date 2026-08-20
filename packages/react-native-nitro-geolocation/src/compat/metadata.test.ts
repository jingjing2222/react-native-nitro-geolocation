import { describe, expect, it } from "vitest";
import type { CompatGeolocationResponseWithMetadataInternal } from "../types";
import {
  toCompatResponse,
  toCompatResponseWithMetadata,
  toNativeCompatOptions
} from "./metadata";

const coords = {
  latitude: 37.5665,
  longitude: 126.978,
  altitude: null,
  accuracy: 5,
  altitudeAccuracy: null,
  heading: null,
  speed: null
};

function createInternalPosition(
  mocked?: boolean
): CompatGeolocationResponseWithMetadataInternal {
  return {
    coords,
    timestamp: 1779015190000,
    mocked,
    provider: "gps"
  };
}

describe("compat metadata projection", () => {
  it("allowlists the exact default response keys", () => {
    const response = toCompatResponse(createInternalPosition(true));

    expect(response).toEqual({ coords, timestamp: 1779015190000 });
    expect(Object.keys(response)).toEqual(["coords", "timestamp"]);
    expect(Object.hasOwn(response, "mocked")).toBe(false);
    expect(Object.hasOwn(response, "provider")).toBe(false);
  });

  it("preserves false instead of treating it as absent", () => {
    const response = toCompatResponseWithMetadata(
      createInternalPosition(false)
    );

    expect(response).toEqual({
      coords,
      timestamp: 1779015190000,
      mocked: false,
      provider: "gps"
    });
    expect(Object.keys(response)).toEqual([
      "coords",
      "timestamp",
      "mocked",
      "provider"
    ]);
  });

  it("omits mocked when the platform cannot determine it", () => {
    const response = toCompatResponseWithMetadata(createInternalPosition());

    expect(Object.keys(response)).toEqual(["coords", "timestamp", "provider"]);
    expect(Object.hasOwn(response, "mocked")).toBe(false);
  });

  it("does not forward the JS-only option to Nitro", () => {
    expect(
      toNativeCompatOptions({
        includeExtraMetadata: true,
        enableHighAccuracy: true,
        timeout: 5000
      })
    ).toEqual({ enableHighAccuracy: true, timeout: 5000 });
  });
});
