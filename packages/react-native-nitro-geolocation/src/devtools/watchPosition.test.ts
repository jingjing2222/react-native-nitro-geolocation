import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./index", () => ({
  getDevtoolsState: () => ({
    position: {
      coords: {
        latitude: 37.5665,
        longitude: 126.978,
        altitude: null,
        accuracy: 5,
        altitudeAccuracy: null,
        heading: null,
        speed: null
      },
      timestamp: 10
    }
  })
}));

import {
  devtoolsStopObserving,
  devtoolsWatchPosition,
  getDevtoolsActiveWatches
} from "./watchPosition";

afterEach(() => {
  devtoolsStopObserving();
  vi.useRealTimers();
  Reflect.deleteProperty(globalThis, "__devtoolsWatchers");
  Reflect.deleteProperty(globalThis, "__devtoolsWatchSequence");
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

    devtoolsStopObserving();

    expect(getDevtoolsActiveWatches()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
