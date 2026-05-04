import type { AndroidAccuracyPreset, LocationAccuracyOptions } from "../types";

/**
 * Location provider types supported on Android.
 */
export type Provider = "gps" | "network" | "passive" | null;
export type AndroidAccuracyMode = AndroidAccuracyPreset;

export interface AndroidAccuracyResolution {
  mode: AndroidAccuracyMode;
  explicitPreset?: AndroidAccuracyPreset;
}

export interface AndroidProviderSelectionInput {
  enableHighAccuracy: boolean;
  accuracy?: LocationAccuracyOptions;
  providers: {
    gps: boolean;
    network: boolean;
    passive?: boolean;
  };
  permissions: {
    fine: boolean;
    coarse: boolean;
  };
}

/**
 * Selects the best available location provider based on user preferences
 * and provider availability.
 *
 * This function implements a fallback strategy:
 * - If high accuracy is requested, prefer GPS, fallback to Network
 * - If low power is preferred, prefer Network, fallback to GPS
 *
 * @param enableHighAccuracy - Whether high accuracy mode is requested
 * @param gpsAvailable - Whether GPS provider is available and enabled
 * @param networkAvailable - Whether Network provider is available and enabled
 * @returns The selected provider, or null if no providers are available
 *
 * @example
 * ```ts
 * // High accuracy mode with both providers available
 * selectProvider(true, true, true); // 'gps'
 *
 * // High accuracy mode but GPS is disabled
 * selectProvider(true, false, true); // 'network'
 *
 * // Low power mode with both providers available
 * selectProvider(false, true, true); // 'network'
 *
 * // No providers available
 * selectProvider(true, false, false); // null
 * ```
 */
export function selectProvider(
  enableHighAccuracy: boolean,
  gpsAvailable: boolean,
  networkAvailable: boolean
): Provider {
  // Determine preferred and fallback providers based on accuracy requirement
  const preferredProvider = enableHighAccuracy ? "gps" : "network";
  const fallbackProvider = enableHighAccuracy ? "network" : "gps";

  // Check if preferred provider is available
  const isPreferredAvailable =
    preferredProvider === "gps" ? gpsAvailable : networkAvailable;

  // Check if fallback provider is available
  const isFallbackAvailable =
    fallbackProvider === "gps" ? gpsAvailable : networkAvailable;

  // Return the best available provider
  if (isPreferredAvailable) {
    return preferredProvider;
  }

  if (isFallbackAvailable) {
    return fallbackProvider;
  }

  return null;
}

export function resolveAndroidAccuracy(
  accuracy: LocationAccuracyOptions | undefined,
  enableHighAccuracy: boolean
): AndroidAccuracyResolution {
  const preset = accuracy?.android;

  return {
    mode: preset ?? (enableHighAccuracy ? "high" : "balanced"),
    explicitPreset: preset
  };
}

export function getAndroidProviderOrder({
  mode,
  explicitPreset
}: AndroidAccuracyResolution): Exclude<Provider, null>[] {
  switch (mode) {
    case "high":
      return ["gps", "network"];
    case "balanced":
      return explicitPreset ? ["network"] : ["network", "gps"];
    case "low":
      return ["network", "passive"];
    case "passive":
      return ["passive"];
  }
}

export function selectProviderForAndroidPermissions({
  enableHighAccuracy,
  accuracy,
  providers,
  permissions
}: AndroidProviderSelectionInput): Provider {
  const providerOrder = getAndroidProviderOrder(
    resolveAndroidAccuracy(accuracy, enableHighAccuracy)
  );

  return (
    providerOrder.find((provider) => {
      if (!providers[provider]) return false;
      if (provider === "gps") return permissions.fine;
      return permissions.coarse || permissions.fine;
    }) ?? null
  );
}
