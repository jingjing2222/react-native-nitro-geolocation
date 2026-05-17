import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkPermission,
  getCurrentPosition,
  getLastKnownPosition,
  getLocationAvailability,
  requestPermission,
  stopObserving,
  unwatch,
  watchPosition
} from ".";

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
  vi.restoreAllMocks();
  Reflect.deleteProperty(globalThis, "navigator");
});

describe("web Modern API", () => {
  it("wraps navigator.geolocation.getCurrentPosition and normalizes nullable coords", async () => {
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

    await expect(
      getCurrentPosition({ enableHighAccuracy: true, timeout: 1234 })
    ).resolves.toEqual({
      coords: {
        latitude: 37.5665,
        longitude: 126.978,
        altitude: null,
        accuracy: 11,
        altitudeAccuracy: null,
        heading: null,
        speed: null
      },
      timestamp: 1779015190000,
      provider: "unknown"
    });
    expect(getCurrentPositionMock.mock.calls[0][2]).toEqual({
      enableHighAccuracy: true,
      timeout: 1234,
      maximumAge: 0
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

  it("lets explicit Android accuracy override legacy enableHighAccuracy", async () => {
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
      enableHighAccuracy: false,
      accuracy: { android: "high" }
    });
    expect(getCurrentPositionMock.mock.calls[0][2]).toMatchObject({
      enableHighAccuracy: true
    });

    await getCurrentPosition({
      enableHighAccuracy: true,
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
      code: 1,
      message: "denied"
    });
  });

  it("maps getLastKnownPosition cache miss to POSITION_UNAVAILABLE", async () => {
    const getCurrentPositionMock = vi.fn((_success, error) => {
      error({ code: 3, message: "Timeout expired" });
    });
    setNavigator({
      geolocation: {
        getCurrentPosition: getCurrentPositionMock,
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      }
    });

    await expect(getLastKnownPosition()).rejects.toEqual({
      code: 2,
      message: "No cached browser location is available."
    });
    expect(getCurrentPositionMock.mock.calls[0][2]).toMatchObject({
      maximumAge: Number.POSITIVE_INFINITY,
      timeout: 0
    });
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

    const firstToken = watchPosition(vi.fn());
    const secondToken = watchPosition(vi.fn());

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
