import {
  LocationErrorCode,
  getCurrentPosition,
  getLocationReadiness,
  getPermissionDetails
} from "react-native-nitro-geolocation";
import { setScenario } from "./dom";
import { getErrorCode } from "./locationAssertions";
import {
  expectPostDenialLocationReadiness,
  expectPostDenialPermissionDetails
} from "./permissionDetailsAssertions";

export async function runDeniedCheck() {
  setScenario("permission-denied", "running");
  try {
    await getCurrentPosition({ maximumAge: 0, timeout: 5000 });
    setScenario(
      "permission-denied",
      "fail",
      { code: "resolved" },
      "Expected browser permission to be blocked, but request resolved."
    );
  } catch (error) {
    const code = getErrorCode(error);
    if (code !== LocationErrorCode.PERMISSION_DENIED) {
      setScenario(
        "permission-denied",
        "fail",
        error,
        `Expected permissionDenied, got ${String(code)}.`
      );
      return;
    }

    setScenario(
      "permission-denied",
      "pass",
      error,
      "Browser returned PERMISSION_DENIED."
    );
    setScenario("permission-details-after-denial", "running");
    try {
      const details = await getPermissionDetails();
      await expectPostDenialPermissionDetails(details);
      setScenario("permission-details-after-denial", "pass", details);
    } catch (detailsError) {
      setScenario("permission-details-after-denial", "fail", detailsError);
      setScenario(
        "permission-denied",
        "fail",
        detailsError,
        "Browser denied location, but detailed permission state was inconsistent."
      );
      return;
    }

    setScenario("location-readiness-after-denial", "running");
    try {
      const readiness = await getLocationReadiness();
      await expectPostDenialLocationReadiness(readiness);
      setScenario("location-readiness-after-denial", "pass", readiness);
    } catch (readinessError) {
      setScenario("location-readiness-after-denial", "fail", readinessError);
      setScenario(
        "permission-denied",
        "fail",
        readinessError,
        "Browser denied location, but readiness was inconsistent."
      );
      return;
    }
  }
}

export async function runUnavailableCheck() {
  setScenario("position-unavailable", "running");
  try {
    const positionResult = await getCurrentPosition({
      accuracy: { android: "high" },
      maximumAge: 0,
      timeout: 10000
    });
    setScenario(
      "position-unavailable",
      "fail",
      positionResult,
      "Expected provider/location services to be unavailable, but browser returned a position."
    );
  } catch (error) {
    const code = getErrorCode(error);
    const status =
      code === LocationErrorCode.POSITION_UNAVAILABLE
        ? "pass"
        : code === LocationErrorCode.TIMEOUT
          ? "manual"
          : "fail";
    setScenario(
      "position-unavailable",
      status,
      error,
      code === LocationErrorCode.POSITION_UNAVAILABLE
        ? "Browser returned POSITION_UNAVAILABLE."
        : code === LocationErrorCode.TIMEOUT
          ? "Browser returned TIMEOUT while provider/location services were disabled. Platform does not expose provider-disabled state."
          : `Expected POSITION_UNAVAILABLE or platform TIMEOUT, got ${String(code)}.`
    );
  }
}

export async function runTimeoutCheck() {
  setScenario("timeout", "running");
  try {
    await getCurrentPosition({
      accuracy: { android: "high" },
      maximumAge: 0,
      timeout: 1
    });
    setScenario(
      "timeout",
      "manual",
      { code: "resolved" },
      "Browser returned cached/fresh location before strict timeout."
    );
  } catch (error) {
    const code = getErrorCode(error);
    setScenario(
      "timeout",
      code === LocationErrorCode.TIMEOUT ? "pass" : "manual",
      error,
      code === LocationErrorCode.TIMEOUT
        ? "Browser returned TIMEOUT."
        : `Got ${String(code)}. Timeout is browser/provider timing dependent.`
    );
  }
}
