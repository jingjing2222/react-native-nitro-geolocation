import { rozenitePlugin } from "@rozenite/vite-plugin";
/// <reference types='vitest' />
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite"
import path from 'node:path';

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
        "@": path.resolve(__dirname, "./src"),
      },
    },
});
