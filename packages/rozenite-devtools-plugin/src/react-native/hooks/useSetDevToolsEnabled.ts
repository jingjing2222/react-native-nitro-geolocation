import { useLayoutEffect } from "react";

declare const __DEV__: boolean;

declare global {
  var __geolocationDevToolsEnabled: boolean | undefined;
  var __geolocationDevToolsMountCount: number | undefined;
}

export function acquireDevToolsActivation(): () => void {
  globalThis.__geolocationDevToolsMountCount =
    (globalThis.__geolocationDevToolsMountCount ?? 0) + 1;
  globalThis.__geolocationDevToolsEnabled = true;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    const remaining = Math.max(
      0,
      (globalThis.__geolocationDevToolsMountCount ?? 1) - 1
    );
    globalThis.__geolocationDevToolsMountCount = remaining;
    if (remaining === 0) {
      globalThis.__geolocationDevToolsEnabled = false;
    }
  };
}

export const useSetDevToolsEnabled = () => {
  useLayoutEffect(() => {
    if (typeof __DEV__ === "undefined" || __DEV__ !== true) {
      return;
    }

    return acquireDevToolsActivation();
  }, []);
};
