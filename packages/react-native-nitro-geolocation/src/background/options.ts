import type { BackgroundLocationOptions } from "./publicTypes";
import type { BackgroundLocationOptions as NativeBackgroundLocationOptions } from "./types";

function publicIOSOptions(ios: NativeBackgroundLocationOptions["ios"]) {
  if (!ios) return ios;
  const {
    deferredUpdatesDistance: _distance,
    deferredUpdatesInterval: _interval,
    ...supported
  } = ios;
  return supported;
}

export function toNativeBackgroundLocationOptions(
  options: BackgroundLocationOptions
): NativeBackgroundLocationOptions {
  const { android, ...rest } = options;
  const sharedOptions = rest.ios
    ? { ...rest, ios: publicIOSOptions(rest.ios) }
    : rest;
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

  const { android, ...rest } = options;
  const sharedOptions = rest.ios
    ? { ...rest, ios: publicIOSOptions(rest.ios) }
    : rest;
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
