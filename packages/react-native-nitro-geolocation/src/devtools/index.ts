import type { ModernGeolocationResponse } from "../types";

declare const __DEV__: boolean;

declare global {
  var __geolocationDevToolsEnabled: boolean | undefined;
  var __geolocationDevtools: DevtoolsState | undefined;
}

interface DevtoolsState {
  position: ModernGeolocationResponse | null;
}

export function getDevtoolsState(): DevtoolsState {
  if (!globalThis.__geolocationDevtools) {
    globalThis.__geolocationDevtools = {
      position: null
    };
  }
  return globalThis.__geolocationDevtools;
}

function isReactNativeDev(): boolean {
  return typeof __DEV__ !== "undefined" && __DEV__ === true;
}

export function isDevtoolsEnabled(): boolean {
  return isReactNativeDev() && globalThis.__geolocationDevToolsEnabled === true;
}
