import type { BackgroundPermissionStatus } from "../background/types";
import type { PermissionStatus } from "../publicTypes";
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

function resolveSettingsGuidance(
  {
    platform,
    foreground,
    environmentSupported = true
  }: PermissionDetailsSignals,
  canAskAgain: boolean | null
): PermissionSettingsGuidance {
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
  if (canAskAgain === true) {
    return "requestPermission";
  }
  return canAskAgain === null
    ? "requestPermissionOrReviewSettings"
    : "reviewSettings";
}

/** @internal Pure normalizer shared by native, Web, and unit tests. */
export function buildPermissionDetails(
  signals: PermissionDetailsSignals
): PermissionDetails {
  const hasForeground = signals.foreground === "granted";
  const canAskAgain = resolveCanAskAgain(signals);
  const scope = hasForeground
    ? signals.background === "granted"
      ? "background"
      : "foreground"
    : "none";

  return {
    status: signals.foreground,
    scope,
    accuracy: hasForeground ? signals.accuracy : "unknown",
    canAskAgain,
    settingsGuidance: resolveSettingsGuidance(signals, canAskAgain)
  };
}
