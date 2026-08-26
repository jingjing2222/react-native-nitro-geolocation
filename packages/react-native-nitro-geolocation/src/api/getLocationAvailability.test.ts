import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  getLocationAvailability: vi.fn()
}));

vi.mock("../NitroGeolocationModule", () => ({
  NitroGeolocationHybridObject: native
}));

import { getLocationAvailability } from "./getLocationAvailability";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getLocationAvailability", () => {
  it("preserves a known native reason", async () => {
    native.getLocationAvailability.mockResolvedValue({
      available: false,
      reason: "permissionDenied"
    });

    await expect(getLocationAvailability()).resolves.toEqual({
      available: false,
      reason: "permissionDenied"
    });
  });

  it("maps an unknown native reason to the public fallback", async () => {
    native.getLocationAvailability.mockResolvedValue({
      available: false,
      reason: "futureNativeReason"
    });

    await expect(getLocationAvailability()).resolves.toEqual({
      available: false,
      reason: "unknown"
    });
  });

  it("omits the reason when native reports availability", async () => {
    native.getLocationAvailability.mockResolvedValue({ available: true });

    await expect(getLocationAvailability()).resolves.toEqual({
      available: true
    });
  });
});
