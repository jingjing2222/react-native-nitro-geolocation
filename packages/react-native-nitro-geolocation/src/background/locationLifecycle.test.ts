import { describe, expect, it, vi } from "vitest";
import {
  type LocationLifecycleNative,
  createLocationLifecycleSubscription
} from "./locationLifecycle";
import type { LocationLifecycleEvent } from "./types";

function createNativeHarness() {
  let capturedListener: ((event: LocationLifecycleEvent) => void) | undefined;
  const removeLocationLifecycleListener = vi.fn();
  const native: LocationLifecycleNative = {
    addLocationLifecycleListener: vi.fn((listener) => {
      capturedListener = listener;
      return "listener-1";
    }),
    removeLocationLifecycleListener
  };

  return {
    native,
    emit: (event: LocationLifecycleEvent) => capturedListener?.(event),
    removeLocationLifecycleListener
  };
}

describe("createLocationLifecycleSubscription", () => {
  it("delivers native pause and resume events unchanged", () => {
    const harness = createNativeHarness();
    const listener = vi.fn();

    createLocationLifecycleSubscription(harness.native, listener);
    harness.emit({ state: "paused", timestamp: 10 });
    harness.emit({ state: "resumed", timestamp: 20 });

    expect(listener).toHaveBeenNthCalledWith(1, {
      state: "paused",
      timestamp: 10
    });
    expect(listener).toHaveBeenNthCalledWith(2, {
      state: "resumed",
      timestamp: 20
    });
  });

  it("removes the native listener at most once", () => {
    const harness = createNativeHarness();
    const subscription = createLocationLifecycleSubscription(
      harness.native,
      vi.fn()
    );

    subscription.remove();
    subscription.remove();

    expect(harness.removeLocationLifecycleListener).toHaveBeenCalledTimes(1);
    expect(harness.removeLocationLifecycleListener).toHaveBeenCalledWith(
      "listener-1"
    );
  });

  it("ignores a native callback that was already queued when removed", () => {
    const harness = createNativeHarness();
    const listener = vi.fn();
    const subscription = createLocationLifecycleSubscription(
      harness.native,
      listener
    );

    subscription.remove();
    harness.emit({ state: "paused", timestamp: 10 });

    expect(listener).not.toHaveBeenCalled();
  });
});
