import { defineConfig, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { namespaceCssLayers } from "./scripts/css-layers";

function namespaceTailwindLayers(): Plugin {
  return {
    name: "seene-namespace-tailwind-layers",
    enforce: "post",
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== "asset" || !output.fileName.endsWith(".css")) continue;
        const source = output.source;
        output.source = namespaceCssLayers(typeof source === "string" ? source : Buffer.from(source).toString("utf8"));
      }
    },
  };
}
export default defineConfig({
  plugins: [tailwindcss(), namespaceTailwindLayers()],
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
