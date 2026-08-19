import { Platform } from "react-native";
import type { LocationReadiness } from "../publicTypes";
import { checkPermission } from "./checkPermission";
import { getLocationAvailability } from "./getLocationAvailability";
import { getProviderStatus } from "./getProviderStatus";
import { buildLocationReadiness } from "./locationReadiness";
import { readLastKnownPosition } from "./positionCache";

/**
 * Diagnose whether the current device is ready to provide a location.
 *
 * This function is read-only: it never requests permission, opens settings,
 * starts location acquisition, or changes provider configuration. Use the
 * returned remediation codes to decide which user-visible action to offer.
 */
export async function getLocationReadiness(): Promise<LocationReadiness> {
  const [permission, providerStatus, availability] = await Promise.all([
    checkPermission(),
    getProviderStatus(),
    getLocationAvailability()
  ]);

  return buildLocationReadiness({
    permission,
    canRequestDeniedPermission: Platform.OS === "android",
    providerStatus,
    availability,
    cachedPosition: readLastKnownPosition(),
    now: Date.now()
  });
}
