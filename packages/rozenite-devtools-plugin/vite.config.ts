import { rozenitePlugin } from "@rozenite/vite-plugin";
/// <reference types='vitest' />
import { defineConfig } from "vite";

export default defineConfig({
  root: __dirname,
  plugins: [rozenitePlugin()],
  base: "./",
  build: {
    outDir: "./dist",
    emptyOutDir: false,
    reportCompressedSize: false,
    minify: true,
    sourcemap: false
  },
  server: {
    port: 3000,
    open: true
  }
});
