import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  cancelCurrentPositionRequest: vi.fn(),
  getCurrentPosition: vi.fn(),
  getCurrentPositionCancellable: vi.fn()
}));

vi.mock("../NitroGeolocationModule", () => ({
  NitroGeolocationHybridObject: native
}));
vi.mock("../devtools", () => ({ isDevtoolsEnabled: () => false }));

import { getCurrentPosition } from "./getCurrentPosition";

const position = {
  coords: {
    latitude: 37.5665,
    longitude: 126.978,
    altitude: null,
    accuracy: 5,
    altitudeAccuracy: null,
    heading: null,
    speed: null
  },
  timestamp: 1779015190000,
  provider: "gps" as const
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCurrentPosition cancellation", () => {
  it("adds current-position metadata to the native result", async () => {
    native.getCurrentPosition.mockImplementation((success) =>
      success(position)
    );

    await expect(getCurrentPosition({ maximumAge: 0 })).resolves.toMatchObject({
      metadata: {
        source: "currentPosition",
        quality: "high"
      }
    });
  });

  it("keeps the existing native path when no signal is provided", async () => {
    native.getCurrentPosition.mockImplementation((success) =>
      success(position)
    );

    await expect(getCurrentPosition({ timeout: 1234 })).resolves.toMatchObject(
      position
    );

    expect(native.getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      { timeout: 1234 },
      expect.any(Function)
    );
    expect(native.getCurrentPositionCancellable).not.toHaveBeenCalled();
  });

  it("rejects a pre-aborted signal without starting a native request", async () => {
    const controller = new AbortController();
    const reason = new Error("cancel before start");
    controller.abort(reason);

    await expect(
      getCurrentPosition({ signal: controller.signal })
    ).rejects.toBe(reason);

    expect(native.getCurrentPosition).not.toHaveBeenCalled();
    expect(native.getCurrentPositionCancellable).not.toHaveBeenCalled();
  });

  it("cancels only the matching in-flight native request", async () => {
    const callbacks = new Map<
      string,
      { success: (value: typeof position) => void }
    >();
    native.getCurrentPositionCancellable.mockImplementation(
      (requestId, success) => {
        callbacks.set(requestId, { success });
      }
    );
    const firstController = new AbortController();
    const secondController = new AbortController();
    const reason = new Error("cancel first only");

    const first = getCurrentPosition({ signal: firstController.signal });
    const second = getCurrentPosition({ signal: secondController.signal });
    const requestIds = [...callbacks.keys()];
    firstController.abort(reason);

    await expect(first).rejects.toBe(reason);
    expect(native.cancelCurrentPositionRequest).toHaveBeenCalledTimes(1);
    expect(native.cancelCurrentPositionRequest).toHaveBeenCalledWith(
      requestIds[0]
    );

    callbacks.get(requestIds[1])?.success(position);
    await expect(second).resolves.toMatchObject(position);
  });

  it("removes abort handling after the request completes", async () => {
    native.getCurrentPositionCancellable.mockImplementation(
      (_requestId, success) => success(position)
    );
    const controller = new AbortController();

    await expect(
      getCurrentPosition({ signal: controller.signal })
    ).resolves.toMatchObject(position);
    controller.abort();

    expect(native.cancelCurrentPositionRequest).not.toHaveBeenCalled();
  });
});
