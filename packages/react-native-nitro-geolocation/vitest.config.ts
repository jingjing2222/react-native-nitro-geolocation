import { reactNative } from "@granite-js/vitest";
import { defineConfig } from "vitest/config";

export default defineConfig({
  cacheDir: ".vitest",
  plugins: [reactNative()],
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"]
  }
});
