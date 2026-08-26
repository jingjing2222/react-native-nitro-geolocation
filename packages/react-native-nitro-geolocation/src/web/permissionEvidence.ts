import type { PermissionStatus } from "../publicTypes";

type ObservedPermissionStatus = Extract<PermissionStatus, "granted" | "denied">;

const permissionEvidenceMaxAgeMs = 30_000;
let evidenceStatus: ObservedPermissionStatus | undefined;
let evidenceObservedAt: number | undefined;

export function rememberWebPermissionGrant(now = Date.now()): void {
  evidenceStatus = "granted";
  evidenceObservedAt = now;
}

export function rememberWebPermissionDenial(now = Date.now()): void {
  evidenceStatus = "denied";
  evidenceObservedAt = now;
}

export function clearWebPermissionEvidence(): void {
  evidenceStatus = undefined;
  evidenceObservedAt = undefined;
}

export function applyRecentWebPermissionEvidence(
  permission: PermissionStatus,
  now: number
): PermissionStatus {
  const evidenceAgeMs =
    evidenceObservedAt === undefined ? undefined : now - evidenceObservedAt;

  if (
    evidenceAgeMs !== undefined &&
    (evidenceAgeMs < 0 || evidenceAgeMs > permissionEvidenceMaxAgeMs)
  ) {
    clearWebPermissionEvidence();
    return permission;
  }

  if (permission === "undetermined" && evidenceAgeMs !== undefined) {
    return evidenceStatus ?? permission;
  }

  return permission;
}
