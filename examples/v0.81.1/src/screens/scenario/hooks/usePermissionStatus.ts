import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  checkPermission,
  requestPermission
} from "react-native-nitro-geolocation";

/**
 * Options for `usePermissionStatus`.
 *
 * @example
 * ```ts
 * const options: UsePermissionStatusOptions = {
 *   autoRefresh: false
 * };
 * ```
 */
export type UsePermissionStatusOptions = {
  /** Whether to call `checkPermission` once when the screen mounts. */
  autoRefresh?: boolean;
};

/**
 * Values returned by `usePermissionStatus`.
 *
 * @example
 * ```ts
 * const permission: UsePermissionStatusResult = usePermissionStatus();
 * await permission.ensurePermission();
 * ```
 *
 * @property {string} permissionStatus - Latest permission status rendered by
 * scenario screens.
 * @property {Dispatch<SetStateAction<string>>} setPermissionStatus - Low-level
 * setter for screens that need to mirror another readiness check.
 * @property {() => Promise<string>} refreshPermission - Re-checks native
 * permission without prompting and stores the returned status.
 * @property {() => Promise<string>} requestLocationPermission - Requests native
 * location permission and stores the returned status.
 * @property {() => Promise<string>} ensurePermission - Requests permission and
 * throws unless the returned status is `granted`.
 */
export type UsePermissionStatusResult = {
  /** Latest permission status shown by scenario screens. */
  permissionStatus: string;
  /** Low-level setter for screens that need to mirror another readiness check. */
  setPermissionStatus: Dispatch<SetStateAction<string>>;
  /** Re-checks native permission and updates `permissionStatus`. */
  refreshPermission: () => Promise<string>;
  /** Requests native location permission and updates `permissionStatus`. */
  requestLocationPermission: () => Promise<string>;
  /** Requests permission and throws unless the returned value is `granted`. */
  ensurePermission: () => Promise<string>;
};

/**
 * Tracks app-level geolocation permission for scenario screens.
 *
 * Use `ensurePermission` in scenarios that require granted permission and
 * `refreshPermission` in `finally` blocks after native calls. Set
 * `autoRefresh: false` when a screen already has a broader readiness check.
 *
 * @example
 * ```tsx
 * const { permissionStatus, ensurePermission, refreshPermission } =
 *   usePermissionStatus();
 *
 * const runScenario = async () => {
 *   try {
 *     await ensurePermission();
 *     await getCurrentPosition({ timeout: 15000 });
 *   } finally {
 *     await refreshPermission();
 *   }
 * };
 * ```
 *
 * @param {UsePermissionStatusOptions} [options] - Optional permission tracking
 * configuration for the current screen.
 * @param {boolean} [options.autoRefresh = true] - Whether to call
 * `checkPermission()` once when the screen mounts. Set this to `false` when the
 * screen already runs a broader readiness check and wants to control the first
 * permission read manually.
 * @returns {UsePermissionStatusResult} Current permission state plus helper
 * functions. `permissionStatus` is the latest rendered value,
 * `refreshPermission()` reads without prompting, `requestLocationPermission()`
 * prompts the user, and `ensurePermission()` prompts and throws unless the
 * returned status is `granted`.
 */
export function usePermissionStatus({
  autoRefresh = true
}: UsePermissionStatusOptions = {}): UsePermissionStatusResult {
  const [permissionStatus, setPermissionStatus] = useState("unknown");

  const refreshPermission = useCallback(async () => {
    const status = await checkPermission();
    setPermissionStatus(status);
    return status;
  }, []);

  const requestLocationPermission = useCallback(async () => {
    const status = await requestPermission();
    setPermissionStatus(status);
    return status;
  }, []);

  const ensurePermission = useCallback(async () => {
    const status = await requestLocationPermission();
    if (status !== "granted") {
      throw new Error(`Permission was not granted: ${status}`);
    }
    return status;
  }, [requestLocationPermission]);

  useEffect(() => {
    if (!autoRefresh) return;

    refreshPermission();
  }, [autoRefresh, refreshPermission]);

  return {
    permissionStatus,
    setPermissionStatus,
    refreshPermission,
    requestLocationPermission,
    ensurePermission
  };
}
