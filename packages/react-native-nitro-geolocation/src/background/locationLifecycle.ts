import type {
  BackgroundEventEnvelope,
  BackgroundSubscription,
  LocationLifecycleEvent
} from "./types";

export interface UnifiedBackgroundEventNative {
  addBackgroundEventListener(
    listener: (event: BackgroundEventEnvelope) => void
  ): string;
  removeBackgroundEventListener(token: string): void;
}

export function createLocationLifecycleSubscription(
  native: UnifiedBackgroundEventNative,
  listener: (event: LocationLifecycleEvent) => void
): BackgroundSubscription {
  let removed = false;
  const token = native.addBackgroundEventListener((event) => {
    if (!removed && event.type === "lifecycle" && event.lifecycle) {
      listener(event.lifecycle);
    }
  });

  return {
    remove() {
      if (removed) {
        return;
      }
      removed = true;
      native.removeBackgroundEventListener(token);
    }
  };
}
