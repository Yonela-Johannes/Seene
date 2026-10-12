import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [tailwindcss()],
  // public/ holds the platform site's own imagery (served at "/" by vite.config.ts).
  // Copying it here would ship ~4MB of unrelated assets inside the published npm package.
  publicDir: false,
  build: {
    outDir: "dist/library",
    emptyOutDir: true,
    lib: { entry: { index: "src/index.ts", preview: "src/preview/index.tsx", vite: "src/vite/seene-plugin.ts", next: "src/vite/next-handler.ts" }, formats: ["es"], fileName: (_format, name) => `${name}.js` },
    rollupOptions: {
      output: { banner: chunk => (chunk.name === "index" || chunk.name === "preview") ? '"use client";' : "" },
      external: ["react", "react-dom", "react/jsx-runtime", "react-error-boundary", "zod", "vite", /^node:/],
    },
    sourcemap: true,
  },
});
