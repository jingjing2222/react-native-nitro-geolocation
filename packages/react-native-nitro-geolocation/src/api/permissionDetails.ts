import type { PermissionStatus } from "../NitroGeolocation.nitro";
import type { BackgroundPermissionStatus } from "../background/types";
import type {
  AccuracyAuthorization,
  PermissionDetails,
  PermissionSettingsGuidance
} from "../publicTypes";

export type PermissionDetailsPlatform = "android" | "ios" | "web";

export interface PermissionDetailsSignals {
  platform: PermissionDetailsPlatform;
  foreground: PermissionStatus;
  background: BackgroundPermissionStatus | "unsupported";
  accuracy: AccuracyAuthorization;
  environmentSupported?: boolean;
  canAskAgain?: boolean | null;
}

function resolveCanAskAgain({
  platform,
  foreground,
  canAskAgain
}: PermissionDetailsSignals): boolean | null {
  if (canAskAgain !== undefined) {
    return canAskAgain;
  }
  if (foreground === "granted" || foreground === "restricted") {
    return false;
  }
  if (platform === "ios") {
    return foreground === "undetermined";
  }
  if (platform === "android" && foreground === "denied") {
    return null;
  }
  return foreground === "undetermined" ? null : false;
}

function resolveSettingsGuidance({
  platform,
  foreground,
  environmentSupported = true
}: PermissionDetailsSignals): PermissionSettingsGuidance {
  if (!environmentSupported) {
    return "useSupportedEnvironment";
  }
  if (foreground === "granted") {
    return "none";
  }
  if (foreground === "restricted") {
    return "managedRestriction";
  }
  if (foreground === "undetermined") {
    return "requestPermission";
  }
  return platform === "android"
    ? "requestPermissionOrReviewSettings"
    : "reviewSettings";
}

/** @internal Pure normalizer shared by native, Web, and unit tests. */
export function buildPermissionDetails(
  signals: PermissionDetailsSignals
): PermissionDetails {
  const hasForeground = signals.foreground === "granted";
  const scope = hasForeground
    ? signals.background === "granted"
      ? "background"
      : "foreground"
    : "none";

  return {
    status: signals.foreground,
    scope,
    accuracy: hasForeground ? signals.accuracy : "unknown",
    canAskAgain: resolveCanAskAgain(signals),
    settingsGuidance: resolveSettingsGuidance(signals)
  };
}
