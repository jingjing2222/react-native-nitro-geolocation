import type { PermissionStatus } from "../publicTypes";
import type {
  GeolocationResponse,
  LocationAvailability,
  LocationProviderStatus,
  LocationReadiness,
  LocationReadinessRemediation
} from "../publicTypes";

export interface LocationReadinessSnapshot {
  permission: PermissionStatus;
  deniedPermissionIsAmbiguous?: boolean;
  environmentSupported?: boolean;
  includeGooglePlayServicesRemediations?: boolean;
  providerStatus: LocationProviderStatus;
  availability: LocationAvailability;
  cachedPosition: GeolocationResponse | undefined;
  now: number;
}

const getCacheReadiness = (
  position: GeolocationResponse | undefined,
  now: number
): LocationReadiness["cache"] => {
  if (!position) {
    return { available: false };
  }

  return {
    available: true,
    timestamp: position.timestamp,
    ageMs: Math.max(0, now - position.timestamp)
  };
};

/** @internal Pure classifier used by native, Web, and unit tests. */
export function buildLocationReadiness({
  permission,
  deniedPermissionIsAmbiguous = false,
  environmentSupported = true,
  includeGooglePlayServicesRemediations = false,
  providerStatus,
  availability,
  cachedPosition,
  now
}: LocationReadinessSnapshot): LocationReadiness {
  const ready =
    permission === "granted" &&
    providerStatus.locationServicesEnabled &&
    availability.available;
  const remediations: LocationReadinessRemediation[] = [];

  if (!environmentSupported) {
    return {
      ready: false,
      permission,
      providerStatus,
      availability,
      cache: getCacheReadiness(cachedPosition, now),
      remediations: ["useSupportedEnvironment"]
    };
  }

  if (permission === "undetermined") {
    remediations.push("requestPermission");
  } else if (permission !== "granted") {
    remediations.push(
      deniedPermissionIsAmbiguous
        ? "requestPermissionOrReviewSettings"
        : "reviewPermissionSettings"
    );
  }

  if (!providerStatus.locationServicesEnabled) {
    remediations.push("enableLocationServices");
  } else if (permission === "granted" && !availability.available) {
    const androidProviders = [
      providerStatus.gpsAvailable,
      providerStatus.networkAvailable,
      providerStatus.passiveAvailable
    ].filter((value): value is boolean => typeof value === "boolean");

    if (
      androidProviders.length > 0 &&
      androidProviders.every((providerAvailable) => !providerAvailable)
    ) {
      remediations.push("enableLocationProvider");
    }
    if (
      includeGooglePlayServicesRemediations &&
      providerStatus.googlePlayServicesAvailable === false
    ) {
      remediations.push("installOrUpdatePlayServices");
    }
    if (
      includeGooglePlayServicesRemediations &&
      providerStatus.googleLocationAccuracyEnabled === false
    ) {
      remediations.push("enableGoogleLocationAccuracy");
    }
    if (remediations.length === 0) {
      remediations.push("retryLocation");
    }
  }

  const cache = getCacheReadiness(cachedPosition, now);
  if (ready && !cache.available) {
    remediations.push("acquirePosition");
  }

  return {
    ready,
    permission,
    providerStatus,
    availability,
    cache,
    remediations
  };
}
