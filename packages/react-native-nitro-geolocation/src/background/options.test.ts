import { describe, expect, it } from "vitest";
import {
  fromNativeBackgroundLocationOptions,
  toNativeBackgroundLocationOptions
} from "./options";

const foregroundService = {
  notificationTitle: "Location",
  notificationText: "Tracking location"
};

describe("background option boundary", () => {
  it("maps the public Android provider to the Nitro-safe spelling", () => {
    expect(
      toNativeBackgroundLocationOptions({
        android: { foregroundService, locationProvider: "android" }
      }).android?.locationProvider
    ).toBe("android_platform");
  });

  it("maps native configuration snapshots back to the public spelling", () => {
    expect(
      fromNativeBackgroundLocationOptions({
        android: { foregroundService, locationProvider: "android_platform" }
      })?.android?.locationProvider
    ).toBe("android");
  });

  it("preserves provider-independent options", () => {
    expect(
      toNativeBackgroundLocationOptions({
        interval: 5_000,
        persist: true
      })
    ).toEqual({ interval: 5_000, persist: true });
  });
});
