import { describe, expect, it } from "vitest";
import type {
  GeolocationResponse,
  LocationProviderStatus
} from "../publicTypes";
import { buildLocationReadiness } from "./locationReadiness";

const providerStatus: LocationProviderStatus = {
  locationServicesEnabled: true,
  backgroundModeEnabled: false
};

const cachedPosition: GeolocationResponse = {
  coords: {
    latitude: 37.5665,
    longitude: 126.978,
    altitude: null,
    accuracy: 10,
    altitudeAccuracy: null,
    heading: null,
    speed: null
  },
  timestamp: 9_000
};

describe("buildLocationReadiness", () => {
  it("reports a ready device with the observed cache age", () => {
    expect(
      buildLocationReadiness({
        permission: "granted",
        providerStatus,
        availability: { available: true },
        cachedPosition,
        now: 10_000
      })
    ).toEqual({
      ready: true,
      permission: "granted",
      providerStatus,
      availability: { available: true },
      cache: {
        available: true,
        ageMs: 1_000,
        timestamp: 9_000
      },
      remediations: []
    });
  });

  it("suggests acquiring a position when the device is ready but the module cache is cold", () => {
    expect(
      buildLocationReadiness({
        permission: "granted",
        providerStatus,
        availability: { available: true },
        cachedPosition: undefined,
        now: 10_000
      }).remediations
    ).toEqual(["acquirePosition"]);
  });

  it("reports permission and service blockers without guessing provider fixes", () => {
    expect(
      buildLocationReadiness({
        permission: "denied",
        providerStatus: {
          ...providerStatus,
          locationServicesEnabled: false,
          gpsAvailable: false,
          networkAvailable: false,
          passiveAvailable: false,
          googlePlayServicesAvailable: false,
          googleLocationAccuracyEnabled: false
        },
        availability: { available: false, reason: "permissionDenied" },
        cachedPosition: undefined,
        now: 10_000
      }).remediations
    ).toEqual(["reviewPermissionSettings", "enableLocationServices"]);
  });

  it("distinguishes an unrequested permission from a denied permission", () => {
    expect(
      buildLocationReadiness({
        permission: "undetermined",
        providerStatus,
        availability: { available: false, reason: "permissionDenied" },
        cachedPosition: undefined,
        now: 10_000
      }).remediations
    ).toEqual(["requestPermission"]);
  });

  it("preserves Android denied ambiguity because first-run and permanent denial are indistinguishable", () => {
    expect(
      buildLocationReadiness({
        permission: "denied",
        deniedPermissionIsAmbiguous: true,
        providerStatus,
        availability: { available: false, reason: "permissionDenied" },
        cachedPosition: undefined,
        now: 10_000
      }).remediations
    ).toEqual(["requestPermissionOrReviewSettings"]);
  });

  it("uses one actionable remediation for an unsupported environment", () => {
    expect(
      buildLocationReadiness({
        permission: "denied",
        environmentSupported: false,
        providerStatus: {
          ...providerStatus,
          locationServicesEnabled: false
        },
        availability: { available: false, reason: "unsupported" },
        cachedPosition: undefined,
        now: 10_000
      }).remediations
    ).toEqual(["useSupportedEnvironment"]);
  });

  it("returns actionable Android provider and Play Services remediations", () => {
    expect(
      buildLocationReadiness({
        permission: "granted",
        providerStatus: {
          ...providerStatus,
          gpsAvailable: false,
          networkAvailable: false,
          passiveAvailable: false,
          googlePlayServicesAvailable: false,
          googleLocationAccuracyEnabled: false
        },
        availability: { available: false, reason: "providerUnavailable" },
        includeGooglePlayServicesRemediations: true,
        cachedPosition: undefined,
        now: 10_000
      }).remediations
    ).toEqual([
      "enableLocationProvider",
      "installOrUpdatePlayServices",
      "enableGoogleLocationAccuracy"
    ]);
  });

  it("omits Play Services remediations when the configured route uses Android platform providers", () => {
    expect(
      buildLocationReadiness({
        permission: "granted",
        providerStatus: {
          ...providerStatus,
          gpsAvailable: false,
          networkAvailable: false,
          passiveAvailable: false,
          googlePlayServicesAvailable: false,
          googleLocationAccuracyEnabled: false
        },
        availability: { available: false, reason: "providerUnavailable" },
        cachedPosition: undefined,
        now: 10_000
      }).remediations
    ).toEqual(["enableLocationProvider"]);
  });

  it("uses a generic retry when availability fails without a specific platform signal", () => {
    expect(
      buildLocationReadiness({
        permission: "granted",
        providerStatus,
        availability: { available: false, reason: "temporarilyUnavailable" },
        cachedPosition: undefined,
        now: 10_000
      }).remediations
    ).toEqual(["retryLocation"]);
  });

  it("clamps future cache timestamps instead of reporting a negative age", () => {
    const readiness = buildLocationReadiness({
      permission: "granted",
      providerStatus,
      availability: { available: true },
      cachedPosition: { ...cachedPosition, timestamp: 11_000 },
      now: 10_000
    });

    expect(readiness.cache.available).toBe(true);
    if (!readiness.cache.available) {
      throw new Error("Expected cache metadata for the observed position.");
    }
    expect(readiness.cache.ageMs).toBe(0);
  });
});
