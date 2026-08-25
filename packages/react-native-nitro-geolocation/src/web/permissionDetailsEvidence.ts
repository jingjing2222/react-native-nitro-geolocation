import type { PermissionStatus } from "../publicTypes";

type ObservedPermissionStatus = Extract<PermissionStatus, "granted" | "denied">;

const permissionEvidenceMaxAgeMs = 30_000;
let evidence:
  | { status: ObservedPermissionStatus; observedAt: number }
  | undefined;

export function rememberWebPermissionDetailsEvidence(
  status: ObservedPermissionStatus,
  now = Date.now()
): void {
  evidence = { status, observedAt: now };
}

export function clearWebPermissionDetailsEvidence(): void {
  evidence = undefined;
}

export function readRecentWebPermissionDetailsEvidence(
  now = Date.now()
): ObservedPermissionStatus | undefined {
  if (!evidence) {
    return undefined;
  }

  const ageMs = now - evidence.observedAt;
  if (ageMs < 0 || ageMs > permissionEvidenceMaxAgeMs) {
    clearWebPermissionDetailsEvidence();
    return undefined;
  }

  return evidence.status;
}
