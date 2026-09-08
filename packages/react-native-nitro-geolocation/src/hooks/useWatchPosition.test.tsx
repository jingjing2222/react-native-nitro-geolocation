import { StrictMode } from "react";
import { type ReactTestRenderer, act, create } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GeolocationResponse } from "../publicTypes";
import type { LocationError } from "../utils/errors";
import type { UseWatchPositionOptions, UseWatchPositionResult } from "./types";

const watches = vi.hoisted(() => ({
  watchPosition: vi.fn(),
  unwatch: vi.fn()
}));
vi.mock("../api", () => watches);
vi.mock("../web/watch", () => watches);
import { useWatchPosition as webHook } from "../web/useWatchPosition";
import { useWatchPosition as nativeHook } from "./useWatchPosition";

const position: GeolocationResponse = {
  coords: {
    latitude: 1,
    longitude: 2,
    accuracy: 3,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null
  },
  timestamp: 123
};
let root: ReactTestRenderer | undefined;

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  watches.watchPosition.mockReturnValue("watch-token");
});
afterEach(async () => {
  if (root) await act(() => root?.unmount());
  root = undefined;
  vi.unstubAllGlobals();
});

describe.each([
  ["native", nativeHook],
  ["web", webHook]
] as const)("%s hook lifecycle", (_name, useWatch) => {
  let state: UseWatchPositionResult;
  function Consumer({ enabled }: UseWatchPositionOptions) {
    state = useWatch({ enabled });
    return null;
  }

  it("ignores queued positions and errors after disabling and after restarting", async () => {
    await act(() => {
      root = create(<Consumer enabled />);
    });
    const [success, error] = watches.watchPosition.mock.calls[0] as [
      (value: GeolocationResponse) => void,
      (value: LocationError) => void
    ];
    await act(() => {
      root?.update(<Consumer enabled={false} />);
    });
    await act(() => {
      success(position);
      error({ code: "timeout", message: "old request" });
    });
    expect(state!).toEqual({ position: null, error: null, isWatching: false });
    expect(watches.unwatch).toHaveBeenCalledWith("watch-token");
    await act(() => {
      root?.update(<Consumer enabled />);
    });
    await act(() => {
      success(position);
    });
    expect(state!.position).toBeNull();
    await act(() => {
      watches.watchPosition.mock.calls[1][0](position);
    });
    expect(state!.position).toBe(position);
  });

  it("accepts synchronous results when StrictMode replays subscription setup", async () => {
    let count = 0;
    watches.watchPosition.mockImplementation((success) => {
      success({ ...position, timestamp: ++count });
      return `watch-${count}`;
    });
    await act(() => {
      root = create(
        <StrictMode>
          <Consumer enabled />
        </StrictMode>
      );
    });
    expect(count).toBeGreaterThan(1);
    expect(state!.position?.timestamp).toBe(count);
    expect(state!.isWatching).toBe(true);
  });
});
