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
});
