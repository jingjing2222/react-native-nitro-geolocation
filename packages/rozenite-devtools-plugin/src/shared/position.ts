import type { Position } from "./types";

export function withMockMetadata(position: Position): Position {
  return {
    ...position,
    mocked: true,
    provider: position.provider ?? "unknown"
  };
}
