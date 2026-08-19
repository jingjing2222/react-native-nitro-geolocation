import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkPermission,
  getCurrentPosition,
  getLastKnownPosition,
  getLastKnownPositionAsync,
  getLocationAvailability,
  getPermissionDetails,
  requestPermission,
  stopObserving,
  unwatch,
  watchPosition
} from ".";
import { clearLastKnownPositionCache } from "../api/positionCache";
import { clearWebPermissionDetailsEvidence } from "./permissionDetailsEvidence";

type TestNavigator = {
  geolocation?: {
    getCurrentPosition: ReturnType<typeof vi.fn>;
    watchPosition: ReturnType<typeof vi.fn>;
    clearWatch: ReturnType<typeof vi.fn>;
  };
  permissions?: {
    query: ReturnType<typeof vi.fn>;
  };
};

function setNavigator(navigatorValue: TestNavigator | undefined) {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: navigatorValue
  });
}

function createPosition(latitude = 37.5665, longitude = 126.978) {
  return {
    coords: {
      latitude,
      longitude,
      altitude: undefined,
      accuracy: 11,
      altitudeAccuracy: undefined,
      heading: undefined,
      speed: undefined
    },
    timestamp: 1779015190000
  };
}

afterEach(() => {
  stopObserving();
  clearLastKnownPositionCache();
  clearWebPermissionDetailsEvidence();
  vi.restoreAllMocks();
  Reflect.deleteProperty(globalThis, "navigator");
});

describe("web Modern API", () => {
  it("returns undefined from a cold sync module cache without querying the browser", () => {
    const getCurrentPositionMock = vi.fn();
    setNavigator({
      geolocation: {
        getCurrentPosition: getCurrentPositionMock,
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      }
    });

    expect(getLastKnownPosition()).toBeUndefined();
    expect(getCurrentPositionMock).not.toHaveBeenCalled();
  });

  it("wraps navigator.geolocation.getCurrentPosition and normalizes nullable coords", async () => {
    const timestamp = Date.now();
    const getCurrentPositionMock = vi.fn((success) => {
      success({ ...createPosition(), timestamp });
    });
    setNavigator({
      geolocation: {
        getCurrentPosition: getCurrentPositionMock,
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      }
    });

    const position = await getCurrentPosition({
      accuracy: { android: "high" },
      timeout: 1234
    });
    expect(position).toEqual({
      coords: {
        latitude: 37.5665,
        longitude: 126.978,
        altitude: null,
        accuracy: 11,
        altitudeAccuracy: null,
        heading: null,
        speed: null
      },
      timestamp,
      metadata: {
        age: expect.any(Number),
        quality: "medium",
        source: "currentPosition"
      },
      provider: "unknown"
    });
    expect(getCurrentPositionMock.mock.calls[0][2]).toEqual({
      enableHighAccuracy: true,
      timeout: 1234,
      maximumAge: 0
    });
    expect(getLastKnownPosition()).toMatchObject({
      coords: { latitude: 37.5665, longitude: 126.978 },
      metadata: { source: "moduleCache" },
      timestamp
    });
  });

  it("applies Modern API default browser position options", async () => {
    const getCurrentPositionMock = vi.fn((success) => {
      success(createPosition());
    });
    setNavigator({
      geolocation: {
        getCurrentPosition: getCurrentPositionMock,
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      }
    });

    await getCurrentPosition();
    expect(getCurrentPositionMock.mock.calls[0][2]).toEqual({
      enableHighAccuracy: undefined,
      timeout: 600000,
      maximumAge: 0
    });
  });

  it("maps Modern Android accuracy presets to browser accuracy", async () => {
    const getCurrentPositionMock = vi.fn((success) => {
      success(createPosition());
    });
    setNavigator({
      geolocation: {
        getCurrentPosition: getCurrentPositionMock,
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      }
    });

    await getCurrentPosition({
      accuracy: { android: "high" }
    });
    expect(getCurrentPositionMock.mock.calls[0][2]).toMatchObject({
      enableHighAccuracy: true
    });

    await getCurrentPosition({
      accuracy: { android: "low" }
    });
    expect(getCurrentPositionMock.mock.calls[1][2]).toMatchObject({
      enableHighAccuracy: false
    });
  });

  it("maps browser error codes to Modern API LocationError codes", async () => {
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn((_success, error) => {
          error({ code: 1, message: "denied" });
        }),
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      }
    });

    await expect(getCurrentPosition()).rejects.toEqual({
      code: LocationErrorCode.PERMISSION_DENIED,
      message: "denied"
    });
  });

  it("returns an async cache miss without querying or requiring browser geolocation", async () => {
    const getCurrentPositionMock = vi.fn();
    setNavigator({
      geolocation: {
        getCurrentPosition: getCurrentPositionMock,
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      }
    });

    await expect(getLastKnownPositionAsync()).resolves.toBeUndefined();
    expect(getCurrentPositionMock).not.toHaveBeenCalled();

    setNavigator(undefined);
    await expect(getLastKnownPositionAsync()).resolves.toBeUndefined();
  });

  it("reads the observed module cache asynchronously without another browser request", async () => {
    const timestamp = Date.now();
    const getCurrentPositionMock = vi.fn((success) => {
      success({ ...createPosition(37.57, 126.99), timestamp });
    });
    setNavigator({
      geolocation: {
        getCurrentPosition: getCurrentPositionMock,
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      }
    });

    await getCurrentPosition();
    await expect(
      getLastKnownPositionAsync({ maximumAge: 30_000 })
    ).resolves.toMatchObject({
      coords: { latitude: 37.57, longitude: 126.99 },
      timestamp
    });
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1);
    expect(getLastKnownPosition()).toMatchObject({
      coords: { latitude: 37.57, longitude: 126.99 }
    });
  });

  it("filters stale observed positions without querying the browser again", async () => {
    const getCurrentPositionMock = vi.fn((success) => {
      success({ ...createPosition(), timestamp: Date.now() - 60_000 });
    });
    setNavigator({
      geolocation: {
        getCurrentPosition: getCurrentPositionMock,
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      }
    });

    await getCurrentPosition();
    await expect(
      getLastKnownPositionAsync({ maximumAge: 1_000 })
    ).resolves.toBeUndefined();
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1);
  });

  it("uses permissions.query when checkPermission can read geolocation state", async () => {
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      },
      permissions: {
        query: vi.fn(async () => ({ state: "prompt" }))
      }
    });

    await expect(checkPermission()).resolves.toBe("undetermined");
  });

  it("reports a browser prompt as askable foreground permission", async () => {
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      },
      permissions: {
        query: vi.fn(async () => ({ state: "prompt" }))
      }
    });

    await expect(getPermissionDetails()).resolves.toEqual({
      status: "undetermined",
      scope: "none",
      accuracy: "unknown",
      canAskAgain: true,
      settingsGuidance: "requestPermission"
    });
  });

  it("reports granted browser permission without claiming precise accuracy", async () => {
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      },
      permissions: {
        query: vi.fn(async () => ({ state: "granted" }))
      }
    });

    await expect(getPermissionDetails()).resolves.toEqual({
      status: "granted",
      scope: "foreground",
      accuracy: "unknown",
      canAskAgain: false,
      settingsGuidance: "none"
    });
  });

  it("reports denied browser permission with settings guidance", async () => {
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      },
      permissions: {
        query: vi.fn(async () => ({ state: "denied" }))
      }
    });

    await expect(getPermissionDetails()).resolves.toMatchObject({
      status: "denied",
      scope: "none",
      canAskAgain: false,
      settingsGuidance: "reviewSettings"
    });
  });

  it("keeps prompt capability unknown when Permissions API is unavailable", async () => {
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      }
    });

    await expect(getPermissionDetails()).resolves.toMatchObject({
      status: "undetermined",
      scope: "none",
      canAskAgain: null,
      settingsGuidance: "requestPermission"
    });
  });

  it("reports a missing Web Geolocation API as unsupported", async () => {
    setNavigator({});

    await expect(getPermissionDetails()).resolves.toEqual({
      status: "denied",
      scope: "none",
      accuracy: "unknown",
      canAskAgain: false,
      settingsGuidance: "useSupportedEnvironment"
    });
  });

  it("uses a recent successful acquisition as permission evidence", async () => {
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn((success) => success(createPosition())),
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      }
    });

    await getCurrentPosition();

    await expect(getPermissionDetails()).resolves.toEqual({
      status: "granted",
      scope: "foreground",
      accuracy: "unknown",
      canAskAgain: false,
      settingsGuidance: "none"
    });
  });

  it("uses a recent permission error as denial evidence", async () => {
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn((_success, error) =>
          error({ code: 1, message: "denied" })
        ),
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      }
    });

    await expect(getCurrentPosition()).rejects.toMatchObject({ code: 1 });

    await expect(getPermissionDetails()).resolves.toEqual({
      status: "denied",
      scope: "none",
      accuracy: "unknown",
      canAskAgain: null,
      settingsGuidance: "requestPermissionOrReviewSettings"
    });
  });

  it("expires Web permission evidence after 30 seconds", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn((success) => success(createPosition())),
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      }
    });

    await getCurrentPosition();
    now.mockReturnValue(31_001);

    await expect(getPermissionDetails()).resolves.toMatchObject({
      status: "undetermined",
      scope: "none",
      canAskAgain: null
    });
  });

  it("discards Web permission evidence after a system clock rollback", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn((success) => success(createPosition())),
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      }
    });

    await getCurrentPosition();
    now.mockReturnValue(999);
    await expect(getPermissionDetails()).resolves.toMatchObject({
      status: "undetermined"
    });

    now.mockReturnValue(1_001);
    await expect(getPermissionDetails()).resolves.toMatchObject({
      status: "undetermined"
    });
  });

  it("does not resurrect evidence after the Permissions API overrides it", async () => {
    const query = vi.fn().mockResolvedValue({ state: "denied" });
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn((success) => success(createPosition())),
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      },
      permissions: { query }
    });

    await getCurrentPosition();
    await expect(getPermissionDetails()).resolves.toMatchObject({
      status: "denied"
    });

    query.mockResolvedValue({ state: "prompt" });
    await expect(getPermissionDetails()).resolves.toMatchObject({
      status: "undetermined",
      canAskAgain: true
    });
  });

  it("marks location unavailable when browser permission is denied", async () => {
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      },
      permissions: {
        query: vi.fn(async () => ({ state: "denied" }))
      }
    });

    await expect(getLocationAvailability()).resolves.toEqual({
      available: false,
      reason: "Browser geolocation permission is denied."
    });
  });

  it("reports satisfied settings when browser geolocation is available", async () => {
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      }
    });

    await expect(requestLocationSettings()).resolves.toEqual({
      outcome: "satisfied",
      providerStatus: {
        locationServicesEnabled: true,
        backgroundModeEnabled: false
      }
    });
  });

  it("reports unavailable settings when browser geolocation is absent", async () => {
    setNavigator(undefined);

    await expect(requestLocationSettings()).resolves.toEqual({
      outcome: "unavailable",
      providerStatus: {
        locationServicesEnabled: false,
        backgroundModeEnabled: false
      }
    });
  });

  it("requests permission with a one-shot geolocation call", async () => {
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn((success) => {
          success(createPosition());
        }),
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      }
    });

    await expect(requestPermission()).resolves.toBe("granted");
  });

  it("tracks web watch tokens and clears individual/all watchers", () => {
    const clearWatch = vi.fn();
    const firstSuccess = vi.fn();
    const watchPositionMock = vi
      .fn()
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(11);
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: watchPositionMock,
        clearWatch
      }
    });

    const firstToken = watchPosition(firstSuccess);
    const secondToken = watchPosition(vi.fn());

    watchPositionMock.mock.calls[0][0]({
      ...createPosition(),
      timestamp: Date.now()
    });
    expect(firstSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          source: "watchPosition",
          quality: "medium"
        })
      })
    );

    expect(firstToken).toMatch(/^web-/);
    expect(secondToken).toMatch(/^web-/);
    expect(watchPositionMock.mock.calls[0][2]).toEqual({
      enableHighAccuracy: undefined,
      timeout: 600000,
      maximumAge: 0
    });
    unwatch(firstToken);
    expect(clearWatch).toHaveBeenCalledWith(10);

    stopObserving();
    expect(clearWatch).toHaveBeenCalledWith(11);
  });
});
