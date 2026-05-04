import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
import type { AccuracyAuthorization } from "../publicTypes";

/**
 * Get current platform location accuracy authorization.
 *
 * iOS maps Core Location full/reduced accuracy authorization. Android maps
 * fine permission to `full` and coarse-only permission to `reduced`.
 */
export function getAccuracyAuthorization(): Promise<AccuracyAuthorization> {
  return NitroGeolocationHybridObject.getAccuracyAuthorization();
}
