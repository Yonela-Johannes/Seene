import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

/** Production build of the public landing page for GitHub Pages.
 * WHAT: a static, server-free site served from https://thatg33k-t33.github.io/Seene/.
 * WHY: GitHub Pages hosts project sites under a repository path, so every emitted
 *      asset URL must carry that base prefix.
 * WHERE: .github/workflows/pages.yml publishes the output of `npm run build:pages`.
 *
 * Deliberately excludes seenePlatformPlugin: that plugin only mounts middleware for
 * `vite dev`/`vite preview` and would pull Node-only modules into a static bundle.
 * The local studio keeps using vite.config.ts, and the npm package build is untouched.
 */
export default defineConfig(() => ({
  base: process.env.SEENE_PAGES_BASE ?? "/Seene/",
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