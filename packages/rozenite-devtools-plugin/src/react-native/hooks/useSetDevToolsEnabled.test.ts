import { afterEach, describe, expect, it } from "vitest";
import { acquireDevToolsActivation } from "./useSetDevToolsEnabled";

afterEach(() => {
  Reflect.deleteProperty(globalThis, "__geolocationDevToolsEnabled");
  Reflect.deleteProperty(globalThis, "__geolocationDevToolsMountCount");
});

describe("DevTools activation lifecycle", () => {
  it("keeps activation enabled until every hook instance unmounts", () => {
    const releaseFirst = acquireDevToolsActivation();
    const releaseSecond = acquireDevToolsActivation();

    expect(globalThis.__geolocationDevToolsEnabled).toBe(true);
    expect(globalThis.__geolocationDevToolsMountCount).toBe(2);

    releaseFirst();
    releaseFirst();
    expect(globalThis.__geolocationDevToolsEnabled).toBe(true);
    expect(globalThis.__geolocationDevToolsMountCount).toBe(1);

    releaseSecond();
    expect(globalThis.__geolocationDevToolsEnabled).toBe(false);
    expect(globalThis.__geolocationDevToolsMountCount).toBe(0);
  });
});
