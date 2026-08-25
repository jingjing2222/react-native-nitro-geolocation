import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
import type {
  LocationAvailability,
  LocationAvailabilityReason
} from "../publicTypes";
import type { LocationAvailability as NativeLocationAvailability } from "../types";

const locationAvailabilityReasons = new Set<LocationAvailabilityReason>([
  "unsupported",
  "permissionUndetermined",
  "permissionDenied",
  "permissionRestricted",
  "locationServicesDisabled",
  "providerUnavailable",
  "temporarilyUnavailable",
  "authorizationUnknown",
  "unknown"
]);

function normalizeLocationAvailability(
  availability: NativeLocationAvailability
): LocationAvailability {
  if (!availability.reason) {
    return { available: availability.available };
  }

  return {
    available: availability.available,
    reason: locationAvailabilityReasons.has(
      availability.reason as LocationAvailabilityReason
    )
      ? (availability.reason as LocationAvailabilityReason)
      : "unknown"
  };
}

/**
 * Check whether the current platform is likely to deliver location updates.
 *
 * @returns Promise resolving to availability state plus an optional reason.
 */
export function getLocationAvailability(): Promise<LocationAvailability> {
  return NitroGeolocationHybridObject.getLocationAvailability().then(
    normalizeLocationAvailability
  );
}
