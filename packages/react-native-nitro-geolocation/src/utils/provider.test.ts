import { describe, expect, it } from "vitest";
import {
  getAndroidProviderOrder,
  resolveAndroidAccuracy,
  selectProvider,
  selectProviderForAndroidPermissions
} from "./provider";

describe("selectProvider", () => {
  it("prefers GPS for high accuracy and falls back to network", () => {
    expect(selectProvider("high", true, true)).toBe("gps");
    expect(selectProvider("high", false, true)).toBe("network");
  });

  it("uses only providers compatible with explicit lower-power presets", () => {
    expect(selectProvider("balanced", true, true)).toBe("network");
    expect(selectProvider("balanced", true, false)).toBeNull();
    expect(selectProvider("low", true, false, true)).toBe("passive");
    expect(selectProvider("passive", true, true, true)).toBe("passive");
  });

  it("returns null when no compatible provider is available", () => {
    expect(selectProvider("high", false, false)).toBeNull();
    expect(selectProvider("low", true, false, false)).toBeNull();
    expect(selectProvider("passive", true, true, false)).toBeNull();
  });
});

describe("resolveAndroidAccuracy", () => {
  it("keeps enableHighAccuracy as the legacy default", () => {
    expect(resolveAndroidAccuracy(undefined, true)).toEqual({
      mode: "high",
      explicitPreset: undefined
    });

    expect(resolveAndroidAccuracy(undefined, false)).toEqual({
      mode: "balanced",
      explicitPreset: undefined
    });
  });

  it("lets explicit Android accuracy override enableHighAccuracy", () => {
    expect(resolveAndroidAccuracy({ android: "high" }, false)).toEqual({
      mode: "high",
      explicitPreset: "high"
    });

    expect(resolveAndroidAccuracy({ android: "low" }, true)).toEqual({
      mode: "low",
      explicitPreset: "low"
    });
  });

  it("ignores iOS-only accuracy presets on Android", () => {
    expect(resolveAndroidAccuracy({ ios: "bestForNavigation" }, false)).toEqual(
      {
        mode: "balanced",
        explicitPreset: undefined
      }
    );
  });
});

describe("getAndroidProviderOrder", () => {
  it("keeps GPS fallback only for legacy balanced mode", () => {
    expect(
      getAndroidProviderOrder({
        mode: "balanced",
        explicitPreset: undefined
      })
    ).toEqual(["network", "gps"]);

    expect(
      getAndroidProviderOrder({
        mode: "balanced",
        explicitPreset: "balanced"
      })
    ).toEqual(["network"]);
  });

  it("keeps low accuracy network-first and passive accuracy passive-only", () => {
    expect(
      getAndroidProviderOrder({
        mode: "low",
        explicitPreset: "low"
      })
    ).toEqual(["network", "passive"]);

    expect(
      getAndroidProviderOrder({
        mode: "passive",
        explicitPreset: "passive"
      })
    ).toEqual(["passive"]);
  });
});

describe("selectProviderForAndroidPermissions", () => {
  it("prefers the network provider for low-accuracy coarse-only requests", () => {
    expect(
      selectProviderForAndroidPermissions({
        enableHighAccuracy: false,
        providers: {
          gps: true,
          network: true
        },
        permissions: {
          fine: false,
          coarse: true
        }
      })
    ).toBe("network");
  });

  it("does not fall back to GPS when only coarse permission is granted", () => {
    expect(
      selectProviderForAndroidPermissions({
        enableHighAccuracy: false,
        providers: {
          gps: true,
          network: false
        },
        permissions: {
          fine: false,
          coarse: true
        }
      })
    ).toBeNull();
  });

  it("does not use GPS for high-accuracy coarse-only requests when network is unavailable", () => {
    expect(
      selectProviderForAndroidPermissions({
        enableHighAccuracy: true,
        providers: {
          gps: true,
          network: false
        },
        permissions: {
          fine: false,
          coarse: true
        }
      })
    ).toBeNull();
  });

  it("can satisfy high-accuracy requests with a coarse-compatible fallback", () => {
    expect(
      selectProviderForAndroidPermissions({
        enableHighAccuracy: true,
        providers: {
          gps: true,
          network: true
        },
        permissions: {
          fine: false,
          coarse: true
        }
      })
    ).toBe("network");
  });

  it("uses GPS as the low-accuracy fallback only when fine permission is granted", () => {
    expect(
      selectProviderForAndroidPermissions({
        enableHighAccuracy: false,
        providers: {
          gps: true,
          network: false
        },
        permissions: {
          fine: true,
          coarse: true
        }
      })
    ).toBe("gps");
  });

  it("uses GPS for high-accuracy requests when fine permission is granted", () => {
    expect(
      selectProviderForAndroidPermissions({
        enableHighAccuracy: true,
        providers: {
          gps: true,
          network: true
        },
        permissions: {
          fine: true,
          coarse: true
        }
      })
    ).toBe("gps");
  });

  it("lets explicit high accuracy override enableHighAccuracy=false", () => {
    expect(
      selectProviderForAndroidPermissions({
        enableHighAccuracy: false,
        accuracy: {
          android: "high"
        },
        providers: {
          gps: true,
          network: true
        },
        permissions: {
          fine: true,
          coarse: true
        }
      })
    ).toBe("gps");
  });

  it("does not fall back to GPS for explicit balanced accuracy", () => {
    expect(
      selectProviderForAndroidPermissions({
        enableHighAccuracy: true,
        accuracy: {
          android: "balanced"
        },
        providers: {
          gps: true,
          network: false
        },
        permissions: {
          fine: true,
          coarse: true
        }
      })
    ).toBeNull();
  });

  it("does not fall back to GPS for explicit low accuracy", () => {
    expect(
      selectProviderForAndroidPermissions({
        enableHighAccuracy: true,
        accuracy: {
          android: "low"
        },
        providers: {
          gps: true,
          network: false,
          passive: false
        },
        permissions: {
          fine: true,
          coarse: true
        }
      })
    ).toBeNull();
  });

  it("uses passive provider only for explicit passive accuracy", () => {
    expect(
      selectProviderForAndroidPermissions({
        enableHighAccuracy: true,
        accuracy: {
          android: "passive"
        },
        providers: {
          gps: true,
          network: true,
          passive: true
        },
        permissions: {
          fine: true,
          coarse: true
        }
      })
    ).toBe("passive");
  });

  it("rejects passive accuracy when the passive provider is disabled", () => {
    expect(
      selectProviderForAndroidPermissions({
        enableHighAccuracy: false,
        accuracy: {
          android: "passive"
        },
        providers: {
          gps: true,
          network: true,
          passive: false
        },
        permissions: {
          fine: true,
          coarse: true
        }
      })
    ).toBeNull();
  });

  it("rejects provider selection when no Android location permission is granted", () => {
    expect(
      selectProviderForAndroidPermissions({
        enableHighAccuracy: false,
        providers: {
          gps: true,
          network: true
        },
        permissions: {
          fine: false,
          coarse: false
        }
      })
    ).toBeNull();
  });

  it("rejects provider selection when every compatible provider is disabled", () => {
    expect(
      selectProviderForAndroidPermissions({
        enableHighAccuracy: false,
        providers: {
          gps: false,
          network: false
        },
        permissions: {
          fine: true,
          coarse: true
        }
      })
    ).toBeNull();
  });
});
