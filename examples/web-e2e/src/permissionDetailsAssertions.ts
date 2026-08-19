import type { PermissionDetails } from "react-native-nitro-geolocation";

export function expectPostRequestPermissionDetails(details: PermissionDetails) {
  const isGranted =
    details.status === "granted" &&
    details.scope === "foreground" &&
    details.accuracy === "unknown" &&
    details.canAskAgain === false &&
    details.settingsGuidance === "none";
  const isUnknownWithoutPermissionsApi =
    details.status === "undetermined" &&
    details.scope === "none" &&
    details.accuracy === "unknown" &&
    details.canAskAgain === null &&
    details.settingsGuidance === "requestPermission";

  if (!isGranted && !isUnknownWithoutPermissionsApi) {
    throw new Error(
      `Unexpected post-request browser permission details: ${JSON.stringify(details)}`
    );
  }
}

export function expectPostDenialPermissionDetails(details: PermissionDetails) {
  const isDenied =
    details.status === "denied" &&
    details.scope === "none" &&
    details.accuracy === "unknown" &&
    details.canAskAgain === false &&
    details.settingsGuidance === "reviewSettings";
  const isUnknownWithoutPermissionsApi =
    details.status === "undetermined" &&
    details.scope === "none" &&
    details.accuracy === "unknown" &&
    details.canAskAgain === null &&
    details.settingsGuidance === "requestPermission";

  if (!isDenied && !isUnknownWithoutPermissionsApi) {
    throw new Error(
      `Unexpected post-denial browser permission details: ${JSON.stringify(details)}`
    );
  }
}
