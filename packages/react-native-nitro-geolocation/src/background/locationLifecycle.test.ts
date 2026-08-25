import { describe, expect, it, vi } from "vitest";
import { createLocationLifecycleSubscription } from "./locationLifecycle";
import type { BackgroundEventEnvelope } from "./types";

function createNativeHarness() {
  let capturedListener: ((event: BackgroundEventEnvelope) => void) | undefined;
  const removeBackgroundEventListener = vi.fn();
  const native = {
    addBackgroundEventListener: vi.fn(
      (listener: (event: BackgroundEventEnvelope) => void) => {
        capturedListener = listener;
        return "listener-1";
      }
    ),
    removeBackgroundEventListener
  };

  return {
    native,
    emit: (event: BackgroundEventEnvelope) => capturedListener?.(event),
    removeBackgroundEventListener
  };
}

function envelope(value: Record<string, unknown>): BackgroundEventEnvelope {
  return value as unknown as BackgroundEventEnvelope;
}

describe("createLocationLifecycleSubscription", () => {
  it("filters pause and resume from the unified background event stream", () => {
    const harness = createNativeHarness();
    const listener = vi.fn();

    createLocationLifecycleSubscription(harness.native, listener);
    harness.emit(
      envelope({
        id: "provider-1",
        type: "providerChange",
        timestamp: 5,
        deliveredToJS: false,
        providerStatus: { locationServicesEnabled: true }
      })
    );
    harness.emit(
      envelope({
        id: "lifecycle-1",
        type: "lifecycle",
        timestamp: 10,
        deliveredToJS: false,
        lifecycle: { state: "paused", timestamp: 10 }
      })
    );
    harness.emit(
      envelope({
        id: "lifecycle-2",
        type: "lifecycle",
        timestamp: 20,
        deliveredToJS: false,
        lifecycle: { state: "resumed", timestamp: 20 }
      })
    );

    expect(listener).toHaveBeenNthCalledWith(1, {
      state: "paused",
      timestamp: 10
    });
    expect(listener).toHaveBeenNthCalledWith(2, {
      state: "resumed",
      timestamp: 20
    });
  });

  it("removes the unified listener at most once", () => {
    const harness = createNativeHarness();
    const subscription = createLocationLifecycleSubscription(
      harness.native,
      vi.fn()
    );

    subscription.remove();
    subscription.remove();

    expect(harness.removeBackgroundEventListener).toHaveBeenCalledTimes(1);
    expect(harness.removeBackgroundEventListener).toHaveBeenCalledWith(
      "listener-1"
    );
  });

  it("ignores a unified callback that was already queued when removed", () => {
    const harness = createNativeHarness();
    const listener = vi.fn();
    const subscription = createLocationLifecycleSubscription(
      harness.native,
      listener
    );

    subscription.remove();
    harness.emit(
      envelope({
        id: "lifecycle-1",
        type: "lifecycle",
        timestamp: 10,
        deliveredToJS: false,
        lifecycle: { state: "paused", timestamp: 10 }
      })
    );

    expect(listener).not.toHaveBeenCalled();
  });
});
