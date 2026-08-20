import {
  type LocationSettingsResult,
  checkPermission,
  getCurrentPosition,
  getLastKnownPosition,
  getLastKnownPositionAsync,
  getLocationReadiness,
  getPermissionDetails,
  requestLocationSettings,
  requestPermission,
  stopObserving,
  unwatch,
  watchPosition
} from "react-native-nitro-geolocation";
import { setScenario } from "./dom";

export function assertModernApiAvailability() {
  const apiShape = {
    checkPermission: typeof checkPermission,
    getPermissionDetails: typeof getPermissionDetails,
    getLocationReadiness: typeof getLocationReadiness,
    requestPermission: typeof requestPermission,
    requestLocationSettings: typeof requestLocationSettings,
    getCurrentPosition: typeof getCurrentPosition,
    getLastKnownPosition: typeof getLastKnownPosition,
    getLastKnownPositionAsync: typeof getLastKnownPositionAsync,
    watchPosition: typeof watchPosition,
    unwatch: typeof unwatch,
    stopObserving: typeof stopObserving
  };
  const apiReady = Object.values(apiShape).every((type) => type === "function");
  setScenario("api-availability", apiReady ? "pass" : "fail", apiShape);
  if (!apiReady) {
    throw new Error("Modern API browser export is incomplete.");
  }
}

export function expectSatisfiedLocationSettings(
  result: LocationSettingsResult
) {
  if (
    result.outcome !== "satisfied" ||
    !result.providerStatus.locationServicesEnabled
  ) {
    throw new Error(
      `Expected satisfied browser settings, got ${result.outcome}.`
    );
  }
}
