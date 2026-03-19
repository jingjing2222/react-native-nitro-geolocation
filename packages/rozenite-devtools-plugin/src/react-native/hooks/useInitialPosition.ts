import { useEffect } from "react";
import type { Position } from "../../shared/types";
import { getDevtoolsState } from "../devtoolsRuntime";

export function useInitialPosition(initialPosition?: Position) {
  useEffect(() => {
    if (initialPosition) {
      const devtools = getDevtoolsState();
      devtools.initialPosition = initialPosition;
      // Only set position if not already set
      if (!devtools.position) {
        devtools.position = initialPosition;
      }
    }
  }, [initialPosition]);
}
