import type { PermissionStatus } from "../NitroGeolocation.nitro";

const permissionEvidenceMaxAgeMs = 30_000;
let lastGrantedAt: number | undefined;

export function rememberWebPermissionGrant(now = Date.now()): void {
  lastGrantedAt = now;
}

export function clearWebPermissionEvidence(): void {
  lastGrantedAt = undefined;
}

export function applyRecentWebPermissionEvidence(
  permission: PermissionStatus,
  now: number
): PermissionStatus {
  if (
    permission === "undetermined" &&
    lastGrantedAt !== undefined &&
    Math.max(0, now - lastGrantedAt) <= permissionEvidenceMaxAgeMs
  ) {
    return "granted";
  }

  return permission;
}
