import type { BackgroundLocationOptions } from "./publicTypes";
import type { BackgroundLocationOptions as NativeBackgroundLocationOptions } from "./types";

export function toNativeBackgroundLocationOptions(
  options: BackgroundLocationOptions
): NativeBackgroundLocationOptions {
  const { android, ...sharedOptions } = options;
  if (!android) {
    return sharedOptions;
  }

  return {
    ...sharedOptions,
    android: {
      ...android,
      locationProvider:
        android.locationProvider === "android"
          ? "android_platform"
          : android.locationProvider
    }
  };
}

export function fromNativeBackgroundLocationOptions(
  options: NativeBackgroundLocationOptions | undefined
): BackgroundLocationOptions | undefined {
  if (!options) {
    return undefined;
  }

  const { android, ...sharedOptions } = options;
  if (!android) {
    return sharedOptions;
  }

  return {
    ...sharedOptions,
    android: {
      ...android,
      locationProvider:
        android.locationProvider === "android_platform"
          ? "android"
          : android.locationProvider
    }
  };
}
