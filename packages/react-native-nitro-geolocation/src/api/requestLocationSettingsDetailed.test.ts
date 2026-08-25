import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  requestLocationSettings: vi.fn()
}));

vi.mock("../NitroGeolocationModule", () => ({
  NitroGeolocationHybridObject: native
}));

import { requestLocationSettingsDetailed } from "./requestLocationSettingsDetailed";

const satisfiedResult = {
  outcome: "satisfied" as const,
  providerStatus: {
    locationServicesEnabled: true,
    gpsAvailable: true,
    networkAvailable: true,
    passiveAvailable: true,
    googleLocationAccuracyEnabled: true
  }
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requestLocationSettingsDetailed", () => {
  it("resolves the deterministic native settings result", async () => {
    native.requestLocationSettings.mockImplementation((success) =>
      success(satisfiedResult)
    );

    await expect(
      requestLocationSettingsDetailed({
        accuracy: { android: "high" },
        alwaysShow: true
      })
    ).resolves.toEqual(satisfiedResult);

    expect(native.requestLocationSettings).toHaveBeenCalledWith(
      expect.any(Function),
      { accuracy: { android: "high" }, alwaysShow: true },
      expect.any(Function)
    );
  });

  it("preserves native request failures", async () => {
    const concurrentRequestError = new Error(
      "A location settings request is already in progress."
    );
    native.requestLocationSettings.mockImplementation(
      (_success, _options, reject) => reject(concurrentRequestError)
    );

    await expect(requestLocationSettingsDetailed()).rejects.toBe(
      concurrentRequestError
    );
  });
});
