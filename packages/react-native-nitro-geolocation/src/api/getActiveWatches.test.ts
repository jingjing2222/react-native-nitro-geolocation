import { describe, expect, it, vi } from "vitest";
import type { ActiveWatch } from "../types";
import { readActiveWatches } from "./activeWatchSnapshot";

describe("readActiveWatches", () => {
  it("returns native and devtools watches in stable token order", () => {
    const nativeWatches: ActiveWatch[] = [
      { token: "native-z", kind: "heading" },
      { token: "native-a", kind: "position" }
    ];
    const getActiveWatches = vi.fn(() => nativeWatches);

    expect(
      readActiveWatches({ getActiveWatches }, [
        { token: "devtools-m", kind: "position" }
      ])
    ).toEqual([
      { token: "devtools-m", kind: "position" },
      { token: "native-a", kind: "position" },
      { token: "native-z", kind: "heading" }
    ]);
    expect(getActiveWatches).toHaveBeenCalledOnce();
  });

  it("returns a snapshot that does not mutate the native array", () => {
    const nativeWatches: ActiveWatch[] = [
      { token: "native-z", kind: "position" },
      { token: "native-a", kind: "position" }
    ];

    const snapshot = readActiveWatches({
      getActiveWatches: () => nativeWatches
    });

    expect(snapshot.map(({ token }) => token)).toEqual([
      "native-a",
      "native-z"
    ]);
    expect(nativeWatches.map(({ token }) => token)).toEqual([
      "native-z",
      "native-a"
    ]);
  });
});
