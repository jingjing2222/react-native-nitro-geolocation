import type { PermissionDetails } from "react-native-nitro-geolocation";

export function expectPostRequestPermissionDetails(details: PermissionDetails) {
  if (
    details.status !== "granted" ||
    details.scope !== "foreground" ||
    details.accuracy !== "unknown" ||
    details.canAskAgain !== false ||
    details.settingsGuidance !== "none"
  ) {
    throw new Error(
      `Unexpected post-request browser permission details: ${JSON.stringify(details)}`
    );
  }
}

export function expectPostDenialPermissionDetails(details: PermissionDetails) {
  if (
    details.status !== "denied" ||
    details.scope !== "none" ||
    details.accuracy !== "unknown" ||
    details.canAskAgain !== false ||
    details.settingsGuidance !== "reviewSettings"
  ) {
    throw new Error(
      `Unexpected post-denial browser permission details: ${JSON.stringify(details)}`
    );
  }
}
