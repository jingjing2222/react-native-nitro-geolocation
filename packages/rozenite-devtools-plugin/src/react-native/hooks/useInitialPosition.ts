import { useLayoutEffect } from "react";
import { withMockMetadata } from "../../shared/position";
import type { Position } from "../../shared/types";

declare global {
  var __geolocationDevtools:
    | {
        position: Position | null;
        initialPosition: Position | null;
      }
    | undefined;
}

function getDevtoolsState() {
  if (!globalThis.__geolocationDevtools) {
    globalThis.__geolocationDevtools = {
      position: null,
      initialPosition: null
    };
  }
  return globalThis.__geolocationDevtools;
}

export function useInitialPosition(initialPosition?: Position) {
  useLayoutEffect(() => {
    if (initialPosition) {
      const position = withMockMetadata(initialPosition);
      const devtools = getDevtoolsState();
      devtools.initialPosition = position;
      // Only set position if not already set
      if (!devtools.position) {
        devtools.position = position;
      }
    }
  }, [initialPosition]);
}
