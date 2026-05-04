import { describe, expect, it } from "vitest";
import { selectProviderForAndroidPermissions } from "./provider";

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
