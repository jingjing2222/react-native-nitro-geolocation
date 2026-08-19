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
 * Selects the best available location provider for an explicit Android
 * accuracy preset and the providers currently available on the device.
 *
 * This function implements a fallback strategy:
 * - High accuracy prefers GPS and falls back to Network
 * - Balanced accuracy uses Network
 * - Low accuracy prefers Network and falls back to Passive
 * - Passive accuracy uses Passive only
 *
 * @param accuracy - The Android accuracy preset requested by the caller
 * @param gpsAvailable - Whether GPS provider is available and enabled
 * @param networkAvailable - Whether Network provider is available and enabled
 * @param passiveAvailable - Whether Passive provider is available and enabled
 * @returns The selected provider, or null if no providers are available
 *
 * @example
 * ```ts
 * // Turn-by-turn navigation with both providers available
 * selectProvider('high', true, true); // 'gps'
 *
 * // Nearby search prefers the network provider
 * selectProvider('balanced', true, true); // 'network'
 *
 * // A low-power refresh can fall back to the passive provider
 * selectProvider('low', true, false, true); // 'passive'
 *
 * // No compatible providers are available
 * selectProvider('high', false, false); // null
 * ```
 */
export function selectProvider(
  accuracy: AndroidAccuracyPreset,
  gpsAvailable: boolean,
  networkAvailable: boolean,
  passiveAvailable = false
): Provider {
  const providers = {
    gps: gpsAvailable,
    network: networkAvailable,
    passive: passiveAvailable
  };
  const providerOrder = getAndroidProviderOrder({
    mode: accuracy,
    explicitPreset: accuracy
  });

  return providerOrder.find((provider) => providers[provider]) ?? null;
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
