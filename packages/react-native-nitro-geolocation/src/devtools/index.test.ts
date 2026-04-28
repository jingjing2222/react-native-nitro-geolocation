import { afterEach, describe, expect, it } from "vitest";
import { isDevtoolsEnabled } from "./index";

const globalState = globalThis as typeof globalThis & {
  __DEV__?: boolean;
  __geolocationDevToolsEnabled?: boolean;
};

const originalState = {
  hasDev: Object.prototype.hasOwnProperty.call(globalState, "__DEV__"),
  dev: globalState.__DEV__,
  hasDevtoolsEnabled: Object.prototype.hasOwnProperty.call(
    globalState,
    "__geolocationDevToolsEnabled"
  ),
  devtoolsEnabled: globalState.__geolocationDevToolsEnabled
};

describe("isDevtoolsEnabled", () => {
  afterEach(() => {
    if (originalState.hasDev) {
      globalState.__DEV__ = originalState.dev;
    } else {
      globalState.__DEV__ = undefined;
    }

    if (originalState.hasDevtoolsEnabled) {
      globalState.__geolocationDevToolsEnabled = originalState.devtoolsEnabled;
    } else {
      globalState.__geolocationDevToolsEnabled = undefined;
    }
  });

  it("enables devtools only when React Native __DEV__ and the devtools flag are true", () => {
    globalState.__DEV__ = true;
    globalState.__geolocationDevToolsEnabled = true;

    expect(isDevtoolsEnabled()).toBe(true);
  });

  it("ignores the devtools flag outside React Native __DEV__", () => {
    globalState.__DEV__ = false;
    globalState.__geolocationDevToolsEnabled = true;

    expect(isDevtoolsEnabled()).toBe(false);
  });

  it("stays disabled when __DEV__ is unavailable", () => {
    globalState.__DEV__ = undefined;
    globalState.__geolocationDevToolsEnabled = true;

    expect(isDevtoolsEnabled()).toBe(false);
  });
});
