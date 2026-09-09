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

  const { actions, stopActionTitle } = android.foregroundService;
  if (actions) {
    const buttonCount = actions.length + (stopActionTitle?.trim() ? 1 : 0);
    if (buttonCount > 3) {
      throw new Error(
        "foregroundService supports at most 3 notification actions including stopActionTitle."
      );
    }
    const ids = new Set<string>();
    for (const action of actions) {
      if (!action.id.trim() || !action.title.trim() || ids.has(action.id)) {
        throw new Error(
          "Notification actions require unique non-empty ids and non-empty titles."
        );
      }
      ids.add(action.id);
    }
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
