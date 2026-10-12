import { defineConfig, mergeConfig } from "vitest/config";
import type { UserConfig } from "vite";
import viteConfig from "./vite.config";

// Vitest reads this file ahead of vite.config.ts. Agent worktrees hold a full checkout of this
// repository, so leaving them undiscovered would run every suite twice and report each failure
// under two paths. Setting exclude replaces the stock defaults, so those entries stay listed.
export default mergeConfig(viteConfig as UserConfig, defineConfig({
  test: {
    include: [
      "**/*.{test,spec}.?(c|m)[jt]s?(x)",
      "tests/migration/test-manifest-migration.ts",
    ],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/.kilo/**",
      "**/.test-dist/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*",
    ],
  },
}));