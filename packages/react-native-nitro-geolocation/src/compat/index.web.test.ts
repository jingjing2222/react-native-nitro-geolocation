import { afterEach, describe, expect, it, vi } from "vitest";
import Geolocation, {
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
  stopObserving();
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

  it("stopObserving clears all active watches", () => {
    const clearMock = vi.fn();
    const watchMock = vi.fn().mockReturnValueOnce(10).mockReturnValueOnce(11);
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: watchMock,
        clearWatch: clearMock
      }
    });

    watchPosition(vi.fn());
    watchPosition(vi.fn());
    stopObserving();

    expect(clearMock).toHaveBeenCalledWith(10);
    expect(clearMock).toHaveBeenCalledWith(11);
    expect(clearMock).toHaveBeenCalledTimes(2);
  });

  it("clearWatch removes id from tracking so stopObserving skips it", () => {
    const clearMock = vi.fn();
    const watchMock = vi.fn().mockReturnValueOnce(20).mockReturnValueOnce(21);
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: watchMock,
        clearWatch: clearMock
      }
    });

    watchPosition(vi.fn());
    watchPosition(vi.fn());
    clearWatch(20);
    stopObserving();

    expect(clearMock).toHaveBeenCalledWith(20);
    expect(clearMock).toHaveBeenCalledWith(21);
    expect(clearMock).toHaveBeenCalledTimes(2);
  });

  it("watchPosition maps browser position to CompatGeolocationResponse", () => {
    const watchMock = vi.fn((success) => {
      success(createBrowserPosition(35.0, 135.0));
      return 99;
    });
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: watchMock,
        clearWatch: vi.fn()
      }
    });

    const success = vi.fn();
    watchPosition(success);

    expect(success).toHaveBeenCalledWith({
      coords: {
        latitude: 35.0,
        longitude: 135.0,
        altitude: null,
        accuracy: 11,
        altitudeAccuracy: null,
        heading: null,
        speed: null
      },
      timestamp: 1779015190000
    });
  });

  it("watchPosition forwards mapped error to error callback", () => {
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn((_success, error) => {
          error({ code: 3, message: "timeout" });
          return 50;
        }),
        clearWatch: vi.fn()
      }
    });

    const error = vi.fn();
    watchPosition(vi.fn(), error);

    expect(error).toHaveBeenCalledWith({
      code: 3,
      message: "timeout",
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3
    });
  });

  it("watchPosition returns -1 and calls error when geolocation is unavailable", () => {
    setNavigator({ geolocation: undefined });

    const error = vi.fn();
    const id = watchPosition(vi.fn(), error);

    expect(id).toBe(-1);
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 2 }));
  });

  it("getCurrentPosition passes undefined options to browser when omitted", () => {
    const mock = vi.fn();
    setNavigator({
      geolocation: {
        getCurrentPosition: mock,
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      }
    });

    getCurrentPosition(vi.fn());

    expect(mock.mock.calls[0][2]).toBeUndefined();
  });

  it("watchPosition passes undefined options to browser when omitted", () => {
    const watchMock = vi.fn(() => 7);
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: watchMock,
        clearWatch: vi.fn()
      }
    });

    watchPosition(vi.fn());

    expect(watchMock.mock.calls[0][2]).toBeUndefined();
  });

  it("getCurrentPosition passes undefined error callback to browser when omitted", () => {
    const mock = vi.fn();
    setNavigator({
      geolocation: {
        getCurrentPosition: mock,
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      }
    });

    getCurrentPosition(vi.fn());

    expect(mock.mock.calls[0][1]).toBeUndefined();
  });

  it("stopObserving is safe to call with no active watches", () => {
    const clearMock = vi.fn();
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn(),
        clearWatch: clearMock
      }
    });

    expect(() => stopObserving()).not.toThrow();
    expect(clearMock).not.toHaveBeenCalled();
  });

  it("stopObserving still clears internal tracking when geolocation is unavailable", () => {
    const watchMock = vi.fn().mockReturnValueOnce(30).mockReturnValueOnce(31);
    const clearMock = vi.fn();
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: watchMock,
        clearWatch: clearMock
      }
    });
    watchPosition(vi.fn());
    watchPosition(vi.fn());

    setNavigator({ geolocation: undefined });
    expect(() => stopObserving()).not.toThrow();

    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: watchMock,
        clearWatch: clearMock
      }
    });
    stopObserving();
    expect(clearMock).not.toHaveBeenCalled();
  });

  it("default export exposes all six compat methods", () => {
    expect(typeof Geolocation.setRNConfiguration).toBe("function");
    expect(typeof Geolocation.requestAuthorization).toBe("function");
    expect(typeof Geolocation.getCurrentPosition).toBe("function");
    expect(typeof Geolocation.watchPosition).toBe("function");
    expect(typeof Geolocation.clearWatch).toBe("function");
    expect(typeof Geolocation.stopObserving).toBe("function");
  });
});
