import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    conditions: ["browser", "import", "module", "default"]
  }
});
