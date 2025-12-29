import type { GeolocationResponse } from "../types";

declare global {
  var __geolocationDevToolsEnabled: boolean | undefined;
  var __geolocationDevtools: DevtoolsState | undefined;
}

interface DevtoolsState {
  position: GeolocationResponse | null;
}

export function getDevtoolsState(): DevtoolsState {
  if (!globalThis.__geolocationDevtools) {
    globalThis.__geolocationDevtools = {
      position: null
    };
  }
  return globalThis.__geolocationDevtools;
}

export function isDevtoolsEnabled(): boolean {
  return globalThis.__geolocationDevToolsEnabled === true;
}
