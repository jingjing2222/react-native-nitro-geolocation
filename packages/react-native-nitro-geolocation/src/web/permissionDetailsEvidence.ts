import type { PermissionStatus } from "../publicTypes";

type ObservedPermissionStatus = Extract<PermissionStatus, "granted" | "denied">;

const permissionEvidenceMaxAgeMs = 30_000;
let evidenceStatus: ObservedPermissionStatus | undefined;
let evidenceObservedAt: number | undefined;

export function rememberWebPermissionDetailsEvidence(
  status: ObservedPermissionStatus,
  now = Date.now()
): void {
  evidenceStatus = status;
  evidenceObservedAt = now;
}

export function clearWebPermissionDetailsEvidence(): void {
  evidenceStatus = undefined;
  evidenceObservedAt = undefined;
}

export function readRecentWebPermissionDetailsEvidence(
  now = Date.now()
): ObservedPermissionStatus | undefined {
  if (evidenceObservedAt === undefined) {
    return undefined;
  }

  const ageMs = now - evidenceObservedAt;
  if (ageMs < 0 || ageMs > permissionEvidenceMaxAgeMs) {
    clearWebPermissionDetailsEvidence();
    return undefined;
  }

  return evidenceStatus;
}
