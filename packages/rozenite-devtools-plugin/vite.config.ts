import path from "node:path";
import { rozenitePlugin } from "@rozenite/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
/// <reference types='vitest' />
import { defineConfig } from "vite";

export default defineConfig({
  root: __dirname,
  plugins: [rozenitePlugin(), tailwindcss()],
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
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
});
