import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearWatch,
  getCurrentPosition,
  requestAuthorization,
  setRNConfiguration,
  stopObserving,
  watchPosition
} from "./index.web";

type TestNavigator = {
  geolocation?: {
    getCurrentPosition: ReturnType<typeof vi.fn>;
    watchPosition: ReturnType<typeof vi.fn>;
    clearWatch: ReturnType<typeof vi.fn>;
  };
};

function setNavigator(value: TestNavigator | undefined) {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value
  });
}

function createBrowserPosition(latitude = 37.5665, longitude = 126.978) {
  return {
    coords: {
      latitude,
      longitude,
      altitude: null,
      accuracy: 11,
      altitudeAccuracy: null,
      heading: null,
      speed: null
    },
    timestamp: 1779015190000
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(globalThis, "navigator");
});

describe("compat web API", () => {
  it("getCurrentPosition maps browser position to CompatGeolocationResponse", () => {
    const mock = vi.fn((success) => success(createBrowserPosition()));
    setNavigator({
      geolocation: {
        getCurrentPosition: mock,
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      }
    });

    const success = vi.fn();
    getCurrentPosition(success, undefined, {
      enableHighAccuracy: true,
      timeout: 5000
    });

    expect(success).toHaveBeenCalledWith({
      coords: {
        latitude: 37.5665,
        longitude: 126.978,
        altitude: null,
        accuracy: 11,
        altitudeAccuracy: null,
        heading: null,
        speed: null
      },
      timestamp: 1779015190000
    });
    expect(mock.mock.calls[0][2]).toEqual({
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: undefined
    });
  });

  it("getCurrentPosition forwards mapped error to error callback", () => {
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn((_success, error) => {
          error({ code: 1, message: "denied" });
        }),
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      }
    });

    const error = vi.fn();
    getCurrentPosition(vi.fn(), error);

    expect(error).toHaveBeenCalledWith({
      code: 1,
      message: "denied",
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3
    });
  });

  it("getCurrentPosition calls error callback when geolocation is unavailable", () => {
    setNavigator({ geolocation: undefined });

    const error = vi.fn();
    getCurrentPosition(vi.fn(), error);

    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 2 }));
  });

  it("watchPosition returns the browser watch id", () => {
    const watchMock = vi.fn(() => 42);
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: watchMock,
        clearWatch: vi.fn()
      }
    });

    const id = watchPosition(vi.fn());
    expect(id).toBe(42);
  });

  it("clearWatch delegates to navigator.geolocation.clearWatch", () => {
    const clearMock = vi.fn();
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn(),
        clearWatch: clearMock
      }
    });

    clearWatch(7);
    expect(clearMock).toHaveBeenCalledWith(7);
  });

  it("requestAuthorization calls success immediately on web", () => {
    const success = vi.fn();
    requestAuthorization(success);
    expect(success).toHaveBeenCalledOnce();
  });

  it("setRNConfiguration is a no-op on web", () => {
    expect(() =>
      setRNConfiguration({ skipPermissionRequests: false })
    ).not.toThrow();
  });

  it("stopObserving is a no-op on web", () => {
    expect(() => stopObserving()).not.toThrow();
  });
});
