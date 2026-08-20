import type {
  LocationReadiness,
  PermissionDetails
} from "react-native-nitro-geolocation";

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

async function hasAuthoritativeDeniedPermissionState() {
  try {
    const permission = await navigator.permissions?.query({
      name: "geolocation" as PermissionName
    });
    return permission?.state === "denied";
  } catch {
    return false;
  }
}

export async function expectPostDenialPermissionDetails(
  details: PermissionDetails
) {
  const hasAuthoritativeDenial = await hasAuthoritativeDeniedPermissionState();
  const expectedCanAskAgain = hasAuthoritativeDenial ? false : null;
  const expectedGuidance = hasAuthoritativeDenial
    ? "reviewSettings"
    : "requestPermissionOrReviewSettings";

  if (
    details.status !== "denied" ||
    details.scope !== "none" ||
    details.accuracy !== "unknown" ||
    details.canAskAgain !== expectedCanAskAgain ||
    details.settingsGuidance !== expectedGuidance
  ) {
    throw new Error(
      `Unexpected post-denial browser permission details: ${JSON.stringify(details)}`
    );
  }
}

export async function expectPostDenialLocationReadiness(
  readiness: LocationReadiness
) {
  const hasAuthoritativeDenial = await hasAuthoritativeDeniedPermissionState();
  const expectedRemediation = hasAuthoritativeDenial
    ? "reviewPermissionSettings"
    : "requestPermissionOrReviewSettings";

  if (
    readiness.ready ||
    readiness.permission !== "denied" ||
    readiness.availability.available ||
    !readiness.remediations.includes(expectedRemediation)
  ) {
    throw new Error(
      `Unexpected post-denial browser readiness: ${JSON.stringify(readiness)}`
    );
  }
}
