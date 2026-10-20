import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig(() => ({
  base: process.env.SEENE_PAGES_BASE ?? "/Seene/seene/",
  resolve: {
    alias: {
      "@thatg33k/seene/preview": path.resolve(process.cwd(), "src/preview/index.tsx"),
      "@thatg33k/seene": path.resolve(process.cwd(), "src/index.ts"),
    },
  },
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist-pages",
    emptyOutDir: true,
    assetsDir: "assets",
    manifest: true,
    rollupOptions: {
      input: {
        index: path.resolve(process.cwd(), "index.html"),
        walkthrough: path.resolve(process.cwd(), "tests/preview/walkthrough-fixture.html"),
      },
    },
    // Routing is hash-based, so GitHub Pages needs no SPA rewrite and no 404 fallback.
    sourcemap: false,
  },
}));