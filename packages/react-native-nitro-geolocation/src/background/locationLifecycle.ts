import type { BackgroundSubscription, LocationLifecycleEvent } from "./types";

export interface LocationLifecycleNative {
  addLocationLifecycleListener(
    listener: (event: LocationLifecycleEvent) => void
  ): string;
  removeLocationLifecycleListener(token: string): void;
}

export function createLocationLifecycleSubscription(
  native: LocationLifecycleNative,
  listener: (event: LocationLifecycleEvent) => void
): BackgroundSubscription {
  let removed = false;
  const token = native.addLocationLifecycleListener((event) => {
    if (!removed) {
      listener(event);
    }
  });

  return {
    remove() {
      if (removed) {
        return;
      }
      removed = true;
      native.removeLocationLifecycleListener(token);
    }
  };
}
