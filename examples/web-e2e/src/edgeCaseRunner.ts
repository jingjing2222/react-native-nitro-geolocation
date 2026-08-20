import {
  getCurrentPosition,
  getPermissionDetails
} from "react-native-nitro-geolocation";
import { setScenario } from "./dom";
import { getErrorCode } from "./locationAssertions";
import { expectPostDenialPermissionDetails } from "./permissionDetailsAssertions";

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
    if (code === 1) {
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
    }
    setScenario(
      "permission-denied",
      code === 1 ? "pass" : "fail",
      error,
      code === 1
        ? "Browser returned PERMISSION_DENIED."
        : `Expected PERMISSION_DENIED code 1, got ${String(code)}.`
    );
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
    const status = code === 2 ? "pass" : code === 3 ? "manual" : "fail";
    setScenario(
      "position-unavailable",
      status,
      error,
      code === 2
        ? "Browser returned POSITION_UNAVAILABLE."
        : code === 3
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
      code === 3 ? "pass" : "manual",
      error,
      code === 3
        ? "Browser returned TIMEOUT."
        : `Got ${String(code)}. Timeout is browser/provider timing dependent.`
    );
  }
}
