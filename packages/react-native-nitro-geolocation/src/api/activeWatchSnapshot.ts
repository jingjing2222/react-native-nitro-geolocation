import type { ActiveWatch } from "../publicTypes";

export interface ActiveWatchesNative {
  getActiveWatches(): ActiveWatch[];
}

export function readActiveWatches(
  native: ActiveWatchesNative,
  additionalWatches: ActiveWatch[] = []
): ActiveWatch[] {
  return [...native.getActiveWatches(), ...additionalWatches].sort(
    (first, second) => first.token.localeCompare(second.token)
  );
}
