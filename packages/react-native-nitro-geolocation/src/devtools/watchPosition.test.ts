import { afterEach, describe, expect, it, vi } from "vitest";

const devtoolsState = vi.hoisted(() => ({
  position: createPosition(37.5665, 126.978, 10)
}));

vi.mock("./index", () => ({ getDevtoolsState: () => devtoolsState }));

import {
  devtoolsStopObserving,
  devtoolsUnwatch,
  devtoolsWatchPosition,
  getDevtoolsActiveWatches
} from "./watchPosition";

function createPosition(
  latitude: number,
  longitude: number,
  timestamp: number
) {
  return {
    coords: {
      latitude,
      longitude,
      altitude: null,
      accuracy: 5,
      altitudeAccuracy: null,
      heading: null,
      speed: null
    },
    timestamp
  };
}

afterEach(() => {
  devtoolsStopObserving();
  vi.useRealTimers();
  Reflect.deleteProperty(globalThis, "__devtoolsWatchers");
  Reflect.deleteProperty(globalThis, "__devtoolsWatchSequence");
  devtoolsState.position = createPosition(37.5665, 126.978, 10);
});

describe("devtools watch observability", () => {
  it("lists active watches and removes them all", () => {
    vi.useFakeTimers();
    vi.setSystemTime(10);
    const firstToken = devtoolsWatchPosition(vi.fn());
    const secondToken = devtoolsWatchPosition(vi.fn());

    expect(firstToken).not.toBe(secondToken);
    expect(getDevtoolsActiveWatches()).toEqual([
      { token: firstToken, kind: "position" },
      { token: secondToken, kind: "position" }
    ]);
    expect(vi.getTimerCount()).toBe(1);

    devtoolsStopObserving();

    expect(getDevtoolsActiveWatches()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("applies independent Android distance filters", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const eager = vi.fn();
    const filtered = vi.fn();

    devtoolsWatchPosition(
      eager,
      undefined,
      { distanceFilter: 0, interval: 100 },
      "android"
    );
    devtoolsWatchPosition(
      filtered,
      undefined,
      { distanceFilter: 500, interval: 100 },
      "android"
    );

    devtoolsState.position = createPosition(37.5668, 126.978, 100);
    vi.advanceTimersByTime(100);
    expect(eager).toHaveBeenCalledTimes(2);
    expect(filtered).toHaveBeenCalledTimes(1);

    devtoolsState.position = createPosition(37.5765, 126.978, 200);
    vi.advanceTimersByTime(100);
    expect(eager).toHaveBeenCalledTimes(3);
    expect(filtered).toHaveBeenCalledTimes(2);
  });

  it("drops Android candidates that arrive before a watch interval", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const success = vi.fn();
    devtoolsWatchPosition(
      success,
      undefined,
      { distanceFilter: 0, interval: 1_000 },
      "android"
    );

    devtoolsState.position = createPosition(37.567, 126.978, 100);
    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(900);
    expect(success).toHaveBeenCalledTimes(1);

    devtoolsState.position = createPosition(37.568, 126.978, 1_100);
    vi.advanceTimersByTime(100);
    expect(success).toHaveBeenCalledTimes(2);
  });

  it("removes only the Android watch that reaches maxUpdates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const success = vi.fn();
    const survivor = vi.fn();
    const token = devtoolsWatchPosition(
      success,
      undefined,
      { distanceFilter: 0, interval: 100, maxUpdates: 2 },
      "android"
    );
    const survivorToken = devtoolsWatchPosition(
      survivor,
      undefined,
      { distanceFilter: 0, interval: 100 },
      "android"
    );

    devtoolsState.position = createPosition(37.567, 126.978, 100);
    vi.advanceTimersByTime(100);

    expect(success).toHaveBeenCalledTimes(2);
    expect(survivor).toHaveBeenCalledTimes(2);
    expect(getDevtoolsActiveWatches()).toEqual([
      { token: survivorToken, kind: "position" }
    ]);
    expect(vi.getTimerCount()).toBe(1);
    expect(devtoolsUnwatch(token)).toBe(true);
    expect(devtoolsUnwatch(token)).toBe(true);
    expect(devtoolsUnwatch(survivorToken)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps Android-only interval and maxUpdates options inactive on iOS", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const success = vi.fn();
    const token = devtoolsWatchPosition(
      success,
      undefined,
      { distanceFilter: 0, interval: 25_000, maxUpdates: 1 },
      "ios"
    );

    devtoolsState.position = createPosition(37.567, 126.978, 100);
    vi.advanceTimersByTime(100);

    expect(success).toHaveBeenCalledTimes(2);
    expect(getDevtoolsActiveWatches()).toEqual([{ token, kind: "position" }]);
  });
});
