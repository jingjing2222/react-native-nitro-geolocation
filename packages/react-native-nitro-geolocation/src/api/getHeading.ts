import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
import type { Heading } from "../publicTypes";

/**
 * Get one platform heading reading.
 *
 * @returns Promise resolving to magnetic/true heading data.
 */
export function getHeading(): Promise<Heading> {
  return new Promise((resolve, reject) => {
    NitroGeolocationHybridObject.getHeading(resolve, reject);
  });
}
