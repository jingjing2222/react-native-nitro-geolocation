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
  it("preserves custom notification actions", () => {
    const android = {
      foregroundService: {
        ...foregroundService,
        actions: [{ id: "pause", title: "Pause" }]
      }
    };
    expect(
      toNativeBackgroundLocationOptions({ android }).android?.foregroundService
        .actions
    ).toEqual(android.foregroundService.actions);
  });

  it("rejects blank or duplicate actions and counts the native stop button in Android's limit", () => {
    for (const actions of [
      [{ id: " ", title: "Pause" }],
      [{ id: "pause", title: " " }],
      [
        { id: "pause", title: "Pause" },
        { id: "pause", title: "Again" }
      ],
      [
        { id: "a", title: "A" },
        { id: "b", title: "B" },
        { id: "c", title: "C" }
      ]
    ]) {
      expect(() =>
        toNativeBackgroundLocationOptions({
          android: {
            foregroundService: {
              ...foregroundService,
              stopActionTitle: "Stop",
              actions
            }
          }
        })
      ).toThrow();
    }
  });

  it("does not expose retired deferred options restored from older native configurations", () => {
    const native = {
      ios: {
        useSignificantChanges: true,
        deferredUpdatesDistance: 500,
        deferredUpdatesInterval: 30
      }
    };
    expect(fromNativeBackgroundLocationOptions(native)).toEqual({
      ios: { useSignificantChanges: true }
    });
    expect(toNativeBackgroundLocationOptions(native)).toEqual({
      ios: { useSignificantChanges: true }
    });
  });
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
