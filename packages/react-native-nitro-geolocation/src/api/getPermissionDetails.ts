import { Platform } from "react-native";
import { checkBackgroundPermission } from "../background";
import type { PermissionDetails } from "../publicTypes";
import { buildPermissionDetails } from "./permissionDetails";

/**
 * Read detailed foreground/background permission scope and accuracy.
 * This function never requests permission or opens settings.
 */
export async function getPermissionDetails(): Promise<PermissionDetails> {
  const permission = await checkBackgroundPermission();

  return buildPermissionDetails({
    platform: Platform.OS === "ios" ? "ios" : "android",
    foreground: permission.foreground,
    background: permission.background,
    accuracy: permission.accuracyAuthorization ?? "unknown"
  });
}
