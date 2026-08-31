import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({ watchPosition: vi.fn() }));
const devtools = vi.hoisted(() => ({
  enabled: true,
  watchPosition: vi.fn(() => "devtools-token")
}));

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("../NitroGeolocationModule", () => ({
  NitroGeolocationHybridObject: native
}));
vi.mock("../devtools", () => ({
  isDevtoolsEnabled: () => devtools.enabled
}));
vi.mock("../devtools/watchPosition", () => ({
  devtoolsWatchPosition: devtools.watchPosition
}));

import { watchPosition } from "./watchPosition";

beforeEach(() => {
  vi.clearAllMocks();
  devtools.enabled = true;
});

describe("watchPosition DevTools routing", () => {
  it("passes v2 watch options and the active platform to DevTools", () => {
    const success = vi.fn();
    const error = vi.fn();
    const options = {
      distanceFilter: 500,
      interval: 1_000,
      maxUpdates: 2
    };

    expect(watchPosition(success, error, options)).toBe("devtools-token");
    expect(devtools.watchPosition).toHaveBeenCalledWith(
      expect.any(Function),
      error,
      options,
      "android"
    );
    expect(native.watchPosition).not.toHaveBeenCalled();
  });

  it("keeps native routing unchanged when DevTools is disabled", () => {
    devtools.enabled = false;
    native.watchPosition.mockReturnValue("native-token");
    const success = vi.fn();
    const error = vi.fn();
    const options = { distanceFilter: 10 };

    expect(watchPosition(success, error, options)).toBe("native-token");
    expect(native.watchPosition).toHaveBeenCalledWith(
      expect.any(Function),
      options,
      error
    );
  });
});
