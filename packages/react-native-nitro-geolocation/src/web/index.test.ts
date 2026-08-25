import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkPermission,
  getActiveWatches,
  getCurrentPosition,
  getLastKnownPosition,
  getLastKnownPositionAsync,
  getLocationAvailability,
  getLocationReadiness,
  getPermissionDetails,
  requestLocationSettingsDetailed,
  requestPermission,
  stopObserving,
  unwatch,
  watchPosition,
  watchProviderStatus
} from ".";
import { clearLastKnownPositionCache } from "../api/positionCache";
import { LocationErrorCodes } from "../utils/errors";
import { clearWebPermissionDetailsEvidence } from "./permissionDetailsEvidence";
import { clearWebPermissionEvidence } from "./permissionEvidence";

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
  clearWebPermissionEvidence();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(globalThis, "navigator");
});

describe("web Modern API", () => {
  it("uses a stable availability reason when browser geolocation is unsupported", async () => {
    setNavigator(undefined);

    await expect(getLocationAvailability()).resolves.toEqual({
      available: false,
      reason: "unsupported"
    });
  });

  it("returns an unavailable detailed settings result without browser geolocation", async () => {
    setNavigator(undefined);

    await expect(requestLocationSettingsDetailed()).resolves.toEqual({
      outcome: "unavailable",
      providerStatus: {
        backgroundModeEnabled: false,
        locationServicesEnabled: false
      }
    });
  });

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
    const timestamp = 1_000;
    vi.spyOn(Date, "now").mockReturnValue(timestamp);
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

  it("marks a browser result stale when it exceeds maximumAge", async () => {
    const timestamp = Date.now() - 10_000;
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn((success) => {
          success({ ...createPosition(), timestamp });
        }),
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      }
    });

    await expect(getCurrentPosition({ maximumAge: 0 })).resolves.toMatchObject({
      metadata: {
        source: "currentPosition",
        staleReason: "maximumAgeExceeded"
      }
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
      code: LocationErrorCodes.PERMISSION_DENIED,
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

    await expect(getCurrentPosition()).rejects.toMatchObject({
      code: LocationErrorCodes.PERMISSION_DENIED
    });

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
      reason: "permissionDenied"
    });
  });

  it("diagnoses a ready browser without starting location acquisition", async () => {
    const getCurrentPositionMock = vi.fn();
    setNavigator({
      geolocation: {
        getCurrentPosition: getCurrentPositionMock,
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      },
      permissions: {
        query: vi.fn(async () => ({ state: "granted" }))
      }
    });

    await expect(getLocationReadiness()).resolves.toMatchObject({
      ready: true,
      permission: "granted",
      providerStatus: { locationServicesEnabled: true },
      availability: { available: true },
      cache: { available: false },
      remediations: ["acquirePosition"]
    });
    expect(getCurrentPositionMock).not.toHaveBeenCalled();
  });

  it("uses a recent successful observation as bounded permission evidence", async () => {
    const getCurrentPositionMock = vi.fn((success) => {
      success({ ...createPosition(), timestamp: Date.now() });
    });
    setNavigator({
      geolocation: {
        getCurrentPosition: getCurrentPositionMock,
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      }
    });

    await getCurrentPosition();
    await expect(getLocationReadiness()).resolves.toMatchObject({
      ready: true,
      permission: "granted",
      cache: { available: true },
      remediations: []
    });
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1);
  });

  it("expires successful observation evidence instead of trusting historical cache", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const getCurrentPositionMock = vi.fn((success) => {
      success({ ...createPosition(), timestamp: 1_000 });
    });
    setNavigator({
      geolocation: {
        getCurrentPosition: getCurrentPositionMock,
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      }
    });

    await getCurrentPosition();
    now.mockReturnValue(31_001);

    await expect(getLocationReadiness()).resolves.toMatchObject({
      ready: false,
      permission: "undetermined",
      cache: { available: true },
      remediations: ["requestPermission"]
    });

    now.mockReturnValue(1_001);
    await expect(getLocationReadiness()).resolves.toMatchObject({
      ready: false,
      permission: "undetermined",
      remediations: ["requestPermission"]
    });
  });

  it("expires successful observation evidence when the system clock moves backward", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn((success) => {
          success({ ...createPosition(), timestamp: 1_000 });
        }),
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      }
    });

    await getCurrentPosition();
    now.mockReturnValue(999);

    await expect(getLocationReadiness()).resolves.toMatchObject({
      ready: false,
      permission: "undetermined",
      remediations: ["requestPermission"]
    });

    now.mockReturnValue(1_001);
    await expect(getLocationReadiness()).resolves.toMatchObject({
      ready: false,
      permission: "undetermined",
      remediations: ["requestPermission"]
    });
  });

  it("uses a successful watch observation as bounded permission evidence", async () => {
    let observePosition:
      | ((position: ReturnType<typeof createPosition>) => void)
      | undefined;
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn((success) => {
          observePosition = success;
          return 10;
        }),
        clearWatch: vi.fn()
      }
    });

    watchPosition(vi.fn());
    observePosition?.(createPosition());

    await expect(getLocationReadiness()).resolves.toMatchObject({
      ready: true,
      permission: "granted",
      cache: { available: true },
      remediations: []
    });
  });

  it("uses a watch permission denial as bounded readiness evidence", async () => {
    let rejectWatch:
      | ((error: { code: number; message: string }) => void)
      | undefined;
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn((success) => success(createPosition())),
        watchPosition: vi.fn((_success, error) => {
          rejectWatch = error;
          return 10;
        }),
        clearWatch: vi.fn()
      }
    });

    await getCurrentPosition();
    watchPosition(vi.fn());
    rejectWatch?.({ code: 1, message: "denied" });

    await expect(getLocationReadiness()).resolves.toMatchObject({
      ready: false,
      permission: "denied",
      availability: { available: false },
      remediations: ["requestPermissionOrReviewSettings"]
    });
  });

  it("uses a one-shot permission denial as bounded readiness evidence", async () => {
    const getCurrentPositionMock = vi
      .fn()
      .mockImplementationOnce((success) => success(createPosition()))
      .mockImplementationOnce((_success, error) =>
        error({ code: 1, message: "denied" })
      );
    setNavigator({
      geolocation: {
        getCurrentPosition: getCurrentPositionMock,
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      }
    });

    await getCurrentPosition();
    await expect(getCurrentPosition()).rejects.toMatchObject({
      code: LocationErrorCodes.PERMISSION_DENIED
    });

    await expect(getLocationReadiness()).resolves.toMatchObject({
      ready: false,
      permission: "denied",
      availability: { available: false },
      remediations: ["requestPermissionOrReviewSettings"]
    });
  });

  it("clears recent permission evidence when Web Geolocation disappears", async () => {
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn((success) => success(createPosition())),
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      }
    });
    await getCurrentPosition();

    setNavigator({});
    await getLocationReadiness();
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      }
    });

    await expect(getLocationReadiness()).resolves.toMatchObject({
      ready: false,
      permission: "undetermined",
      remediations: ["requestPermission"]
    });
  });

  it("clears recent permission evidence when Permissions API reports denied", async () => {
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

    await expect(getLocationReadiness()).resolves.toMatchObject({
      ready: false,
      permission: "denied",
      remediations: ["reviewPermissionSettings"]
    });

    query.mockResolvedValue({ state: "prompt" });
    await expect(getLocationReadiness()).resolves.toMatchObject({
      ready: false,
      permission: "undetermined",
      remediations: ["requestPermission"]
    });
  });

  it("diagnoses a missing Web Geolocation API as an unsupported environment", async () => {
    setNavigator({});

    await expect(getLocationReadiness()).resolves.toMatchObject({
      ready: false,
      providerStatus: { locationServicesEnabled: false },
      availability: { available: false },
      remediations: ["useSupportedEnvironment"]
    });
  });

  it("diagnoses denied browser permission without prompting", async () => {
    const getCurrentPositionMock = vi.fn();
    setNavigator({
      geolocation: {
        getCurrentPosition: getCurrentPositionMock,
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      },
      permissions: {
        query: vi.fn(async () => ({ state: "denied" }))
      }
    });

    await expect(getLocationReadiness()).resolves.toMatchObject({
      ready: false,
      permission: "denied",
      availability: { available: false },
      remediations: ["reviewPermissionSettings"]
    });
    expect(getCurrentPositionMock).not.toHaveBeenCalled();
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
    expect(getActiveWatches()).toEqual([
      { token: firstToken, kind: "position" },
      { token: secondToken, kind: "position" }
    ]);
    unwatch(firstToken);
    expect(clearWatch).toHaveBeenCalledWith(10);
    expect(getActiveWatches()).toEqual([
      { token: secondToken, kind: "position" }
    ]);

    stopObserving();
    expect(clearWatch).toHaveBeenCalledWith(11);
    expect(getActiveWatches()).toEqual([]);
  });

  it("observes distinct provider status changes and stops by token", async () => {
    const windowListeners = new Map<string, EventListener>();
    const documentListeners = new Map<string, EventListener>();
    vi.stubGlobal(
      "addEventListener",
      vi.fn((type: string, listener: EventListener) => {
        windowListeners.set(type, listener);
      })
    );
    vi.stubGlobal(
      "removeEventListener",
      vi.fn((type: string) => {
        windowListeners.delete(type);
      })
    );
    vi.stubGlobal("document", {
      addEventListener: vi.fn((type: string, listener: EventListener) => {
        documentListeners.set(type, listener);
      }),
      removeEventListener: vi.fn((type: string) => {
        documentListeners.delete(type);
      })
    });
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      }
    });
    const success = vi.fn();

    const token = watchProviderStatus(success);
    expect(success).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(success).toHaveBeenCalledWith({
      locationServicesEnabled: true,
      backgroundModeEnabled: false
    });

    windowListeners.get("focus")?.({} as Event);
    await Promise.resolve();
    expect(success).toHaveBeenCalledTimes(1);

    setNavigator(undefined);
    documentListeners.get("visibilitychange")?.({} as Event);
    await Promise.resolve();
    expect(success).toHaveBeenLastCalledWith({
      locationServicesEnabled: false,
      backgroundModeEnabled: false
    });
    expect(success).toHaveBeenCalledTimes(2);

    const stalePageShowListener = windowListeners.get("pageshow");
    unwatch(token);
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn(),
        clearWatch: vi.fn()
      }
    });
    stalePageShowListener?.({} as Event);
    await Promise.resolve();
    expect(success).toHaveBeenCalledTimes(2);
  });

  it("stopObserving cancels every provider status watcher", async () => {
    setNavigator(undefined);
    const first = vi.fn();
    const second = vi.fn();

    watchProviderStatus(first);
    watchProviderStatus(second);
    await Promise.resolve();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    stopObserving();
    await Promise.resolve();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
