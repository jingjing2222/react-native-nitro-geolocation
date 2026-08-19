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
  const evidenceAgeMs =
    lastGrantedAt === undefined ? undefined : now - lastGrantedAt;
  if (
    permission === "undetermined" &&
    evidenceAgeMs !== undefined &&
    evidenceAgeMs >= 0 &&
    evidenceAgeMs <= permissionEvidenceMaxAgeMs
  ) {
    return "granted";
  }

  return permission;
}
