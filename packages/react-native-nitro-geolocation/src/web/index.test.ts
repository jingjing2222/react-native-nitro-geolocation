import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkPermission,
  getCurrentPosition,
  getLastKnownPosition,
  getLastKnownPositionAsync,
  getLocationAvailability,
  requestLocationSettings,
  requestPermission,
  stopObserving,
  unwatch,
  watchPosition
} from ".";
import { clearLastKnownPositionCache } from "../api/positionCache";
import { LocationErrorCode } from "../utils/errors";

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

  it("does not start browser geolocation for a pre-aborted request", async () => {
    const getCurrentPositionMock = vi.fn();
    const watchPositionMock = vi.fn();
    setNavigator({
      geolocation: {
        getCurrentPosition: getCurrentPositionMock,
        watchPosition: watchPositionMock,
        clearWatch: vi.fn()
      }
    });
    const controller = new AbortController();
    const reason = new Error("cancel before start");
    controller.abort(reason);

    await expect(
      getCurrentPosition({ signal: controller.signal })
    ).rejects.toBe(reason);
    expect(getCurrentPositionMock).not.toHaveBeenCalled();
    expect(watchPositionMock).not.toHaveBeenCalled();
  });

  it("rejects a pre-aborted request before checking browser support", async () => {
    setNavigator(undefined);
    const controller = new AbortController();
    const reason = new Error("cancel without browser support");
    controller.abort(reason);

    await expect(
      getCurrentPosition({ signal: controller.signal })
    ).rejects.toBe(reason);
  });

  it("clears an in-flight browser request when its signal aborts", async () => {
    let lateSuccess:
      | ((position: ReturnType<typeof createPosition>) => void)
      | undefined;
    const clearWatch = vi.fn();
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn((success) => {
          lateSuccess = success;
          return 41;
        }),
        clearWatch
      }
    });
    const controller = new AbortController();
    const reason = new Error("cancel active request");

    const request = getCurrentPosition({ signal: controller.signal });
    controller.abort(reason);

    await expect(request).rejects.toBe(reason);
    expect(clearWatch).toHaveBeenCalledTimes(1);
    expect(clearWatch).toHaveBeenCalledWith(41);
    lateSuccess?.(createPosition());
    expect(clearWatch).toHaveBeenCalledTimes(1);
  });

  it("clears the browser watch after a cancellable request succeeds", async () => {
    const clearWatch = vi.fn();
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn((success) => {
          success(createPosition());
          return 42;
        }),
        clearWatch
      }
    });
    const controller = new AbortController();

    await expect(
      getCurrentPosition({ signal: controller.signal })
    ).resolves.toMatchObject({
      coords: { latitude: 37.5665, longitude: 126.978 }
    });
    expect(clearWatch).toHaveBeenCalledTimes(1);
    expect(clearWatch).toHaveBeenCalledWith(42);

    controller.abort();
    expect(clearWatch).toHaveBeenCalledTimes(1);
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
