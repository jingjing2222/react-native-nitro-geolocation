import { describe, expect, it, vi } from "vitest";
import type { Position } from "../shared/types";

vi.mock("@rozenite/plugin-bridge", () => ({
  useRozeniteDevToolsClient: vi.fn()
}));

import { createInitialPosition } from "./useGeolocationDevTools";

describe("createInitialPosition", () => {
  it("creates the documented Seoul fixture by default", () => {
    const position = createInitialPosition();

    expect(position).toMatchObject({
      coords: { latitude: 37.5665, longitude: 126.978 },
      mocked: true,
      provider: "unknown"
    });
  });

  it("preserves an explicitly configured fixture", () => {
    const position = {
      coords: {
        latitude: 1,
        longitude: 2,
        altitude: null,
        accuracy: 3,
        altitudeAccuracy: null,
        heading: null,
        speed: null
      },
      timestamp: 4
    } satisfies Position;

    expect(createInitialPosition(position)).toBe(position);
  });
});
