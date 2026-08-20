import type { PermissionStatus } from "../NitroGeolocation.nitro";

type ObservedPermissionStatus = Extract<PermissionStatus, "granted" | "denied">;

const permissionEvidenceMaxAgeMs = 30_000;
let evidence:
  | { status: ObservedPermissionStatus; observedAt: number }
  | undefined;

export function rememberWebPermissionGrant(now = Date.now()): void {
  evidence = { status: "granted", observedAt: now };
}

export function rememberWebPermissionDenial(now = Date.now()): void {
  evidence = { status: "denied", observedAt: now };
}

export function clearWebPermissionEvidence(): void {
  evidence = undefined;
}

export function applyRecentWebPermissionEvidence(
  permission: PermissionStatus,
  now: number
): PermissionStatus {
  const evidenceAgeMs = evidence ? now - evidence.observedAt : undefined;

  if (
    evidenceAgeMs !== undefined &&
    (evidenceAgeMs < 0 || evidenceAgeMs > permissionEvidenceMaxAgeMs)
  ) {
    clearWebPermissionEvidence();
    return permission;
  }

  if (permission === "undetermined" && evidenceAgeMs !== undefined) {
    return evidence?.status ?? permission;
  }

  return permission;
}
