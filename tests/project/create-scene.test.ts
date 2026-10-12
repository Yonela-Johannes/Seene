import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer as createTcpServer } from "node:net";
import os from "node:os";
import path from "node:path";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { SceneRecipeSchema } from "../../src/core/recipes";
import { discoverRecipes } from "../../src/project/discovery";
import { seeneCreateScenePlugin } from "../../src/vite/seene-plugin";

const roots: string[] = [];
const servers: ViteDevServer[] = [];
const recipe = (id: string, title = "Scene") => ({
  version: 1,
  id,
  title,
  description: "Created by Seene",
  definition: {
    scene: {
      version: 3,
      camera: { perspective: 1800, rotateX: 4, rotateY: -7 },
      focus: { distance: 1800, fStop: 8, focalLength: 50, maxBlur: 6 },
      nodes: [{ id: "seene-application" }],
    },
    motion: { durationMs: 4000, tracks: [] },
  },
});

async function freePort(): Promise<number> {
  const probe = createTcpServer();
  await new Promise<void>((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const address = probe.address();
  if (!address || typeof address === "string") throw new Error("Vite did not expose a local address.");
  await new Promise<void>(resolve => probe.close(() => resolve()));
  return address.port;
}

async function start() {
  const root = await mkdtemp(path.join(os.tmpdir(), "seene-create-scene-"));
  roots.push(root);
  const server = await createServer({
    configFile: false,
    root,
    plugins: [seeneCreateScenePlugin()],
    server: { host: "127.0.0.1", port: await freePort(), strictPort: true },
    logLevel: "silent",
  });
  servers.push(server);
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") throw new Error("Vite did not expose a local address.");
  return { root, origin: `http://127.0.0.1:${address.port}` };
}

async function create(origin: string, id: string, value = recipe(id)) {
  return fetch(`${origin}/__seene/create-scene`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, recipe: value }),
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => server.close()));
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

describe("Vite scene creation bridge", () => {
  it.each([
    ["a plain title", "Product tour"],
    ["a title containing quotes", "Quoted \"double\" and 'single' title"],
    ["a title containing JSX-sensitive characters", "<Scene> {value} </Surface> & more"],
  ])("writes a validated persistent recipe and a parseable wrapper for %s", async (_name, title) => {
    const { root, origin } = await start();
    const id = "product-tour";
    const value = recipe(id, title);
    const response = await create(origin, id, value);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, id });
    const directory = path.join(root, "src/seene/scenes");
    const saved = JSON.parse(await readFile(path.join(directory, `${id}.scene.json`), "utf8"));
    const source = await readFile(path.join(directory, `${id}.tsx`), "utf8");
    expect(saved).toEqual(SceneRecipeSchema.parse(value));
    expect(saved.title).toBe(title);
    expect(source).toContain("// @seene-scaffold-version 1");
    expect(source).toContain('"use client";');
    expect(source).not.toContain("{children}");
    expect(source).not.toContain(title);
    expect(ts.transpileModule(source, {
      fileName: `${id}.tsx`,
      reportDiagnostics: true,
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
    }).diagnostics).toEqual([]);
    expect((await readdir(directory)).sort()).toEqual([`${id}.scene.json`, `${id}.tsx`]);
    const catalog = await discoverRecipes(root, id);
    expect(catalog.issues).toEqual([]);
    expect(catalog.scenes.map(scene => scene.id)).toEqual([id]);
    expect(catalog.selected?.id).toBe(id);
  });

  it("rejects invalid recipes and conflicting IDs without creating files", async () => {
    const { root, origin } = await start();
    expect((await create(origin, "wrong-id", recipe("another-id"))).status).toBe(400);
    expect(await readdir(root)).not.toContain("src");
    const id = "existing-scene";
    expect((await create(origin, id)).status).toBe(200);
    expect((await create(origin, id)).status).toBe(409);
    expect((await readdir(path.join(root, "src/seene/scenes"))).sort()).toEqual([
      `${id}.scene.json`, `${id}.tsx`,
    ]);
    const catalog = await discoverRecipes(root);
    expect(catalog.issues).toEqual([]);
    expect(catalog.scenes.map(scene => scene.id)).toEqual([id]);
  });

  it("reports an incomplete source pair instead of overwriting an existing scene file", async () => {
    const { root, origin } = await start();
    const id = "partial-scene";
    const directory = path.join(root, "src/seene/scenes");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, `${id}.tsx`), "export default () => null;");
    expect((await create(origin, id)).status).toBe(409);
    expect(await readdir(directory)).toEqual([`${id}.tsx`]);
  });
});
