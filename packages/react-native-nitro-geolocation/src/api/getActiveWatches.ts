import { NitroGeolocationHybridObject } from "../NitroGeolocationModule";
import { getDevtoolsActiveWatches } from "../devtools/watchPosition";
import type { ActiveWatch } from "../publicTypes";
import { readActiveWatches } from "./activeWatchSnapshot";

/**
 * Return a point-in-time snapshot of active position and heading watches.
 *
 * The snapshot includes both position and heading watches. Pass a returned
 * token to unwatch(), or call stopObserving() to remove every active watch.
 */
export function getActiveWatches(): ActiveWatch[] {
  return readActiveWatches(
    NitroGeolocationHybridObject,
    getDevtoolsActiveWatches()
  );
}
