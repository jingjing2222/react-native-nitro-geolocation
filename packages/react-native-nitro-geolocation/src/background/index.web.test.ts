import { describe, expect, it } from "vitest";
import {
  diagnoseBackgroundLocation,
  registerBackgroundTask
} from "./index.web";

describe("background web API parity", () => {
  it("rejects background diagnosis as unsupported", async () => {
    await expect(diagnoseBackgroundLocation()).rejects.toThrow(
      "Background location is not available in the browser."
    );
  });

  it("accepts the native task handler signature before throwing", () => {
    expect(() => registerBackgroundTask(() => undefined)).toThrow(
      "Background location is not available in the browser."
    );
  });
});
