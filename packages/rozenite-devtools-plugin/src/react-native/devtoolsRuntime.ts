import type { Position } from "../shared/types";

const DEVTOOLS_NOT_CONNECTED_ERROR_MESSAGE =
  "Geolocation devtools not connected. Press 'j' in Metro to open devtools and enable the geolocation plugin.";

interface DevtoolsState {
  position: Position | null;
  initialPosition: Position | null;
}

interface DevtoolsRuntimeLocationError {
  code: number;
  message: string;
}

interface DevtoolsRuntime {
  isEnabled: () => boolean;
  getCurrentPosition: () => Promise<Position> | null;
  watchPosition: (
    success: (position: Position) => void,
    error?: (error: DevtoolsRuntimeLocationError) => void
  ) => string;
  unwatch: (token: string) => boolean;
}

declare global {
  var __geolocationDevtools: DevtoolsState | undefined;
  var __geolocationDevToolsEnabled: boolean | undefined;
  var __geolocationDevtoolsRuntime: DevtoolsRuntime | undefined;
  var __geolocationDevtoolsWatchers:
    | Record<string, ReturnType<typeof setInterval>>
    | undefined;
}

export function getDevtoolsState(): DevtoolsState {
  if (!globalThis.__geolocationDevtools) {
    globalThis.__geolocationDevtools = {
      position: null,
      initialPosition: null
    };
  }

  return globalThis.__geolocationDevtools;
}

export function installDevtoolsRuntime(): void {
  globalThis.__geolocationDevtoolsRuntime = {
    isEnabled: () => globalThis.__geolocationDevToolsEnabled === true,
    getCurrentPosition: () => {
      const devtools = getDevtoolsState();
      if (devtools.position) {
        return Promise.resolve(devtools.position);
      }

      return Promise.reject(
        new Error(DEVTOOLS_NOT_CONNECTED_ERROR_MESSAGE)
      );
    },
    watchPosition: (success, error) => {
      const devtools = getDevtoolsState();

      if (!devtools.position) {
        error?.({
          code: 2,
          message: DEVTOOLS_NOT_CONNECTED_ERROR_MESSAGE
        });

        return `devtools-error-${Date.now()}`;
      }

      let previousPosition = devtools.position;
      success(devtools.position);

      const interval = setInterval(() => {
        if (devtools.position && devtools.position !== previousPosition) {
          previousPosition = devtools.position;
          success(devtools.position);
        }
      }, 100);

      const token = `devtools-${Date.now()}`;
      globalThis.__geolocationDevtoolsWatchers =
        globalThis.__geolocationDevtoolsWatchers || {};
      globalThis.__geolocationDevtoolsWatchers[token] = interval;

      return token;
    },
    unwatch: (token) => {
      if (!token.startsWith("devtools-")) {
        return false;
      }

      if (token.startsWith("devtools-error-")) {
        return true;
      }

      const watchers = globalThis.__geolocationDevtoolsWatchers;
      if (watchers?.[token]) {
        clearInterval(watchers[token]);
        delete watchers[token];
        return true;
      }

      return false;
    }
  };
}

export function uninstallDevtoolsRuntime(): void {
  const watchers = globalThis.__geolocationDevtoolsWatchers;
  if (watchers) {
    for (const token of Object.keys(watchers)) {
      clearInterval(watchers[token]);
    }
  }

  globalThis.__geolocationDevtoolsWatchers = undefined;
  globalThis.__geolocationDevtoolsRuntime = undefined;
}
