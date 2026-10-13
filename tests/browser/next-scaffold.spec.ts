import { test, expect } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, lstat } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:http";

const projectRoot = path.resolve(fileURLToPath(import.meta.url), "../../../");
const cacheRoot = path.join(os.tmpdir(), "seene-e2e-cache");
let sharedTarballPath = "";
const baseNodeModules: Record<string, string> = {};

async function freePort(): Promise<number> {
  const s = createServer();
  await new Promise<void>(r => s.listen({ port: 0, host: "127.0.0.1" }, () => r()));
  const port = (s.address() as any).port;
  await new Promise<void>(r => s.close(() => r()));
  return port;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await readFile(p, "utf8");
    return true;
  } catch {
    return false;
  }
}

async function waitForFile(p: string, timeout = 20000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await fileExists(p)) return;
    await new Promise(r => setTimeout(r, 200));
  }
  expect(await fileExists(p)).toBe(true);
}

function runCmd(exe: string, args: string[], cwd: string) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(exe, args, {
      cwd,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout?.on("data", d => (out += d));
    child.stderr?.on("data", d => (out += d));
    child.on("error", reject);
    child.on("exit", code =>
      code === 0 ? resolve(out) : reject(new Error(`Command ${exe} ${args.join(" ")} failed with code ${code}:\n${out}`)),
    );
  });
}

async function startNextDev(hostDir: string, port: number): Promise<ChildProcess> {
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: hostDir,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout?.on("data", d => (log += d));
  child.stderr?.on("data", d => (log += d));

  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 200; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (res.ok) return child;
    } catch {}
    if (child.exitCode !== null) throw new Error(`next dev exited prematurely (${child.exitCode}):\n${log}`);
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error(`next dev failed to start on ${url} within 20s:\n${log}`);
}

type FixtureEnv = {
  id: string;
  label: string;
  nextVersion: string;
  reactVersion: string;
  isPages: boolean;
  scratchDir?: string;
  hostDir?: string;
  devProc?: ChildProcess;
  devUrl?: string;
};

const matrix: FixtureEnv[] = [
  { id: "next14-app", label: "Next 14.2 App Router", nextVersion: "14.2.25", reactVersion: "18.3.1", isPages: false },
  { id: "next15-app", label: "Next 15.2 App Router", nextVersion: "15.2.0", reactVersion: "19.0.0", isPages: false },
  { id: "next15-pages", label: "Next 15.2 Pages Router", nextVersion: "15.2.0", reactVersion: "19.0.0", isPages: true },
];

async function prepareNextProject(env: FixtureEnv) {
  const scratchDir = await mkdtemp(path.join(cacheRoot, `fixture-${env.id}-`));
  env.scratchDir = scratchDir;
  const hostDir = path.join(scratchDir, "host");
  env.hostDir = hostDir;
  await mkdir(hostDir, { recursive: true });

  await writeFile(
    path.join(hostDir, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      dependencies: {
        react: env.reactVersion,
        "react-dom": env.reactVersion,
        next: env.nextVersion,
        "@thatg33k/seene": sharedTarballPath,
      },
    }),
  );

  const npmCache = path.join(cacheRoot, "npm-cache");
  await runCmd("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", npmCache], hostDir);

  const cli = path.join(hostDir, "node_modules/@thatg33k/seene/dist/cli/seene.js");

  await mkdir(path.join(hostDir, "src/components"), { recursive: true });
  await writeFile(
    path.join(hostDir, "src/components/Header.tsx"),
    '"use client";\nimport React from "react";\nexport default function Header() { return <header data-testid="next-host-header">Real Next.js Header</header>; }\n',
  );

  if (env.isPages) {
    await mkdir(path.join(hostDir, "pages"), { recursive: true });
    await writeFile(path.join(hostDir, "pages/index.jsx"), 'import React from "react"; export default function Home() { return <h1>Pages Router Homepage</h1>; }');
  } else {
    await mkdir(path.join(hostDir, "app"), { recursive: true });
    await writeFile(
      path.join(hostDir, "app/layout.jsx"),
      'import React from "react"; export default function Layout({children}) { return <html><body>{children}</body></html>; }',
    );
    await writeFile(
      path.join(hostDir, "app/page.jsx"),
      'import React from "react"; export default function Page() { return <h1>Main App Page</h1>; }',
    );
  }

  // Real generator call: seene init --host
  await runCmd(process.execPath, [cli, "init", "--host", "src/components/Header.tsx", "--json"], hostDir);

  // Write broken scene 1: throw-import
  const importRecipe = {
    version: 1,
    id: "throw-import",
    title: "Throw Import",
    definition: {
      width: 1400,
      height: 980,
      scene: { version: 3, camera: {}, focus: {}, nodes: [{ id: "host" }] },
    },
  };
  await writeFile(path.join(hostDir, "src/seene/scenes/throw-import.scene.json"), JSON.stringify(importRecipe, null, 2));
  await writeFile(
    path.join(hostDir, "src/seene/scenes/throw-import.tsx"),
    `// @seene-scaffold-version 1
"use client";
throw new Error("Simulated module import failure");
export default function ThrowImport() { return null; }
`,
  );

  // Write broken scene 2: throw-render
  const renderRecipe = {
    version: 1,
    id: "throw-render",
    title: "Throw Render",
    definition: {
      width: 1400,
      height: 980,
      scene: { version: 3, camera: {}, focus: {}, nodes: [{ id: "host" }] },
    },
  };
  await writeFile(path.join(hostDir, "src/seene/scenes/throw-render.scene.json"), JSON.stringify(renderRecipe, null, 2));
  await writeFile(
    path.join(hostDir, "src/seene/scenes/throw-render.tsx"),
    `// @seene-scaffold-version 1
"use client";
import React from "react";
import { Surface } from "@thatg33k/seene";

export default function ThrowRender() {
  if (typeof window !== "undefined") {
    throw new Error("Simulated component render failure");
  }
  return <Surface id="host">Render Fail</Surface>;
}
`,
  );

  // Write no-host scene (placeholder)
  const noHostRecipe = {
    version: 1,
    id: "no-host",
    title: "No Host Scene",
    definition: {
      width: 1400,
      height: 980,
      scene: { version: 3, camera: {}, focus: {}, nodes: [{ id: "host" }] },
    },
  };
  await writeFile(path.join(hostDir, "src/seene/scenes/no-host.scene.json"), JSON.stringify(noHostRecipe, null, 2));
  await writeFile(
    path.join(hostDir, "src/seene/scenes/no-host.tsx"),
    `// @seene-scaffold-version 1
"use client";
import { Surface } from "@thatg33k/seene";

export default function SceneNoHost() {
  return (
    <Surface id="host" style={{ width: 1400, height: 980, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#18181b", color: "#f4f4f5", fontFamily: "system-ui, sans-serif", borderRadius: 16, border: "1px solid #27272a" }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: "#ffffff" }}>Scene Preview</h1>
      <p style={{ fontSize: 14, color: "#a1a1aa" }}>Edit src/seene/scenes/no-host.tsx to add your component.</p>
    </Surface>
  );
}
`,
  );

  // Sync catalog
  await runCmd(process.execPath, [cli, "sync"], hostDir);

  const port = await freePort();
  env.devProc = await startNextDev(hostDir, port);
  env.devUrl = `http://127.0.0.1:${port}`;
}

test.beforeAll("Setup base modules and fixtures", async () => {
  await mkdir(cacheRoot, { recursive: true });
  const packDir = await mkdtemp(path.join(cacheRoot, "pack-"));
  const packOut = await runCmd("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", packDir], projectRoot);
  const startIdx = Math.min(...[packOut.indexOf("{"), packOut.indexOf("[")].filter(i => i >= 0));
  const endIdx = Math.max(packOut.lastIndexOf("}"), packOut.lastIndexOf("]"));
  const parsedObj = JSON.parse(packOut.slice(startIdx, endIdx + 1));
  const packed = Array.isArray(parsedObj) ? parsedObj[0] : Object.values(parsedObj)[0];
  sharedTarballPath = path.join(packDir, (packed as any).filename);

  await Promise.all(matrix.map(env => prepareNextProject(env)));
});

test.afterAll(async () => {
  for (const env of matrix) {
    env.devProc?.kill();
    if (env.scratchDir) {
      await rm(env.scratchDir, { recursive: true, force: true }).catch(() => {});
    }
  }
});

for (const env of matrix) {
  test.describe(`Tier 2 (Playwright): Real next dev fixture (${env.label})`, () => {
    test.setTimeout(120000);

    test("renders a fresh scene node with host component and no-host placeholder", async ({ page }) => {
      // 1. Scene with host component
      const urlWithHost = `${env.devUrl}/seene?seene-preview=1&seene-scene=header`;
      await page.goto(urlWithHost);

      const header = page.locator('[data-seene-preview] [data-testid="next-host-header"]');
      await expect(header).toBeVisible({ timeout: 20000 });
      await expect(header).toHaveText("Real Next.js Header");

      // 2. Scene without host component (placeholder)
      const urlNoHost = `${env.devUrl}/seene?seene-preview=1&seene-scene=no-host`;
      await page.goto(urlNoHost);

      const placeholder = page.locator('[data-seene-preview] [data-seene-id="host"] p');
      await expect(placeholder).toBeVisible({ timeout: 20000 });
      await expect(placeholder).toHaveText("Edit src/seene/scenes/no-host.tsx to add your component.");
    });

    test("Fixture A: shows explicit error on module import failure, names exact file/reason, keeps catalog usable and host route working", async ({ page }) => {
      const url = `${env.devUrl}/seene?seene-preview=1&seene-scene=throw-import`;
      await page.goto(url);

      const libraryContainer = page.locator('main[data-seene-library]');
      await expect(libraryContainer).toBeVisible({ timeout: 20000 });

      const filePath = libraryContainer.locator('span.text-white');
      await expect(filePath).toHaveText("src/seene/scenes/throw-import.tsx");

      const errorMsg = libraryContainer.locator('p.text-red-400');
      await expect(errorMsg).toHaveText("Simulated module import failure");

      const renderError = page.locator('[data-seene-error]');
      await expect(renderError).toHaveCount(0);

      // Return to catalog
      await page.goto(`${env.devUrl}/seene?seene-preview=1`);

      const validSceneLink = page.locator('main[data-seene-library] a[data-scene-id="header"]');
      await expect(validSceneLink).toBeVisible({ timeout: 20000 });
      await validSceneLink.click({ force: true });

      const header = page.locator('[data-seene-preview] [data-testid="next-host-header"]');
      await expect(header).toBeVisible({ timeout: 20000 });
      await expect(header).toHaveText("Real Next.js Header");

      const hostRes = await page.request.get(env.devUrl!);
      expect(hostRes.ok()).toBe(true);
    });

    test("Fixture B: shows explicit error on component render failure, stack/details, Retry button, and catalog stays usable", async ({ page }) => {
      const url = `${env.devUrl}/seene?seene-preview=1&seene-scene=throw-render`;
      await page.goto(url);

      const previewContainer = page.locator('main[data-seene-preview]');
      await expect(previewContainer).toBeVisible({ timeout: 20000 });

      const errorBoundary = previewContainer.locator('[data-seene-error]');
      await expect(errorBoundary).toBeVisible();

      const errorText = errorBoundary.locator('p').first();
      await expect(errorText).toHaveText("Simulated component render failure");

      const details = errorBoundary.locator('details');
      await expect(details).toBeVisible();

      const importError = page.locator('main[data-seene-library] h1');
      await expect(importError).toHaveCount(0);

      const retryBtn = errorBoundary.getByRole("button", { name: "Retry scene" });
      await expect(retryBtn).toBeVisible();

      // Return to catalog
      await page.goto(`${env.devUrl}/seene?seene-preview=1`);

      const validSceneLink = page.locator('main[data-seene-library] a[data-scene-id="header"]');
      await expect(validSceneLink).toBeVisible();
    });

    test("creates a scene from the Studio UI and writes recipe + component files to disk, then renders it", async ({ page }) => {
      const catalogUrl = `${env.devUrl}/seene?seene-preview=1`;
      await page.goto(catalogUrl);
      await expect(page.locator("main[data-seene-library]")).toBeVisible({ timeout: 20000 });

      // Open the create-scene dialog from the catalog toolbar and author a new scene inline.
      await page.getByRole("button", { name: "+ Create scene" }).click();
      await expect(page.locator('section[role="dialog"]')).toBeVisible();

      const sceneTitle = "E2E Studio Create";
      const slug = "e2e-studio-create";
      await page.locator("#seene-create-title").fill(sceneTitle);
      await page.locator("button[type=submit]").click();

      // Primary proof: the browser-initiated POST reached /api/seene/create-scene, which
      // wrote the recipe + scaffolded component to disk (recipe+component pair in the host).
      const scenesDir = path.join(env.hostDir!, "src/seene/scenes");
      const recipePath = path.join(scenesDir, `${slug}.scene.json`);
      const componentPath = path.join(scenesDir, `${slug}.tsx`);

      await waitForFile(recipePath, 20000);
      await waitForFile(componentPath, 20000);

      const recipe = JSON.parse(await readFile(recipePath, "utf8"));
      expect(recipe.id).toBe(slug);
      expect(recipe.title).toBe(sceneTitle);
      const component = await readFile(componentPath, "utf8");
      expect(component).toContain('Surface id="host"');
      expect(component).toContain(`Edit src/seene/scenes/${slug}.tsx to add your component.`);

      // The create endpoint regenerated catalog.js server-side; reload so Next recompiles
      // the updated static import catalog, then the freshly authored scene propagates through.
      await page.goto(catalogUrl, { waitUntil: "domcontentloaded" });
      await expect(page.locator(`main[data-seene-library] a[data-scene-id="${slug}"]`)).toHaveCount(1, { timeout: 30000 });

      // Click the new scene; the catalog resolves it to host mode and renders the scaffolded
      // Surface authored in Seene Studio, proving the round-trip from UI creation to preview.
      await page.locator(`main[data-seene-library] a[data-scene-id="${slug}"]`).click();
      const placeholder = page.locator('[data-seene-preview] [data-seene-id="host"] p');
      await expect(placeholder).toBeVisible({ timeout: 20000 });
      await expect(placeholder).toHaveText(`Edit src/seene/scenes/${slug}.tsx to add your component.`);
    });

    test("edits a scene backdrop from the inspector, saves it to the recipe JSON on disk, and persists across reloads", async ({ page }) => {
      test.setTimeout(90000);
      const recipePath = path.join(env.hostDir!, "src/seene/scenes/header.scene.json");
      let putSeen = false;
      page.on("request", (request) => {
        if (request.url().endsWith("/api/seene/create-scene") && request.method() === "PUT") putSeen = true;
      });

      await page.goto(`${env.devUrl}/seene?seene-preview=1&seene-scene=header`);
      await expect(page.locator('[data-seene-preview] [data-testid="next-host-header"]')).toHaveText("Real Next.js Header", { timeout: 20000 });

      await page.getByRole("button", { name: "Scene Inspector" }).click();
      await expect(page.locator("[data-testid=seene-inspector-save]")).toBeVisible();

      await page.locator('input[name="seene-backdrop"][value="custom"]').click();
      await page.locator('input[type="color"]').fill("#ff0000");
      await page.locator("[data-testid=seene-inspector-save]").click();

      await expect.poll(async () => {
        const recipe = JSON.parse(await readFile(recipePath, "utf8"));
        return recipe.definition.backdrop;
      }, { timeout: 20000 }).toBe("#ff0000");
      expect(putSeen).toBe(true);

      // Reload and confirm the saved backdrop is restored in the inspector.
      await page.goto(`${env.devUrl}/seene?seene-preview=1&seene-scene=header`, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Scene Inspector" }).click();
      await expect(page.locator('input[name="seene-backdrop"][value="custom"]')).toBeChecked();
      await expect(page.locator('input[type="color"]')).toHaveValue("#ff0000");
    });
  });
}
