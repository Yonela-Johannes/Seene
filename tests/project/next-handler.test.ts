import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { PassThrough } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import { defaultSceneDefinition } from "../../src/core";
import { executeProjectCommand, sha256 } from "../../src/project/commands";
import { createPagesHandler, handleNextScenePost } from "../../src/vite/next-handler";

const roots: string[] = [];
async function put(root: string, file: string, text: string) {
  const target = path.join(root, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, text);
}
async function nextProject() {
  const root = await mkdtemp(path.join(os.tmpdir(), "seene-next-api-"));
  roots.push(root);
  await put(root, "package.json", JSON.stringify({
    dependencies: { next: "15.2.8", react: "19.2.0", "react-dom": "19.2.0", "@thatg33k/seene": "0.1.5" },
    scripts: { dev: "next dev" },
  }));
  for (const name of ["next", "react", "react-dom"])
    await put(root, `node_modules/${name}/package.json`, JSON.stringify({ name, version: name === "next" ? "15.2.8" : "19.2.0" }));
  await put(root, "node_modules/@thatg33k/seene/package.json", JSON.stringify({
    name: "@thatg33k/seene",
    exports: { "./preview": { import: "./preview.js" }, "./next": { import: "./next.js" } },
  }));
  await put(root, "node_modules/@thatg33k/seene/preview.js", "export {};");
  await put(root, "node_modules/@thatg33k/seene/next.js", "export {};");
  await put(root, "app/layout.tsx", "export default function Layout({children}) { return <html><body>{children}</body></html> }");
  const initialized = await executeProjectCommand("init-project", {}, { root });
  expect(initialized.success).toBe(true);
  return root;
}
function scenePayload(id = "launch-screen") {
  return {
    id,
    recipe: { version: 1, id, title: "Launch screen", definition: defaultSceneDefinition() },
  };
}
function sceneRequest(root: string, id = "launch-screen") {
  return handleNextScenePost(new Request("http://localhost/api/seene/create-scene", {
    method: "POST",
    headers: { origin: "http://localhost", "content-type": "application/json" },
    body: JSON.stringify(scenePayload(id)),
  }), root);
}
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

it("creates Next.js scene pairs through JSON, refreshes the generated catalog and keeps the managed connection valid", async () => {
  vi.stubEnv("NODE_ENV", "development");
  const root = await nextProject();
  const response = await sceneRequest(root);
  expect(response.status, await response.clone().text()).toBe(200);
  expect(response.headers.get("content-type")).toContain("application/json");
  await expect(response.json()).resolves.toMatchObject({ success: true, id: "launch-screen" });
  expect(await readFile(path.join(root, "src/seene/scenes/launch-screen.scene.json"), "utf8")).toContain('"id": "launch-screen"');
  expect(await readFile(path.join(root, "src/seene/scenes/launch-screen.tsx"), "utf8")).toContain("export default function");
  const catalog = await readFile(path.join(root, "src/seene/catalog.js"), "utf8");
  expect(catalog).toContain("launch-screen.scene.json");
  const manifest = JSON.parse(await readFile(path.join(root, ".seene/integration.json"), "utf8"));
  expect(manifest.files["src/seene/catalog.js"]).toBe(sha256(catalog));
  expect((await executeProjectCommand("validate-project", {}, { root })).success).toBe(true);
});

it("handles the Next.js Pages Router Node request stream", async () => {
  vi.stubEnv("NODE_ENV", "development");
  const root = await nextProject();
  const request = new PassThrough() as PassThrough & Partial<IncomingMessage>;
  Object.assign(request, { method: "POST", headers: { host: "localhost", origin: "http://localhost" } });
  let finish!: () => void;
  const completed = new Promise<void>(resolve => { finish = resolve; });
  let status = 0;
  let body = "";
  const responseState = { statusCode: 0 };
  const response = {
    get statusCode() { return responseState.statusCode; },
    set statusCode(value: number) { responseState.statusCode = value; },
    setHeader() {},
    end(value?: string) { body = value ?? ""; status = responseState.statusCode; finish(); },
  } as unknown as ServerResponse;
  createPagesHandler(request as IncomingMessage, response, root);
  request.end(JSON.stringify(scenePayload("pages-router-scene")));
  await completed;
  expect(status).toBe(200);
  expect(JSON.parse(body)).toMatchObject({ success: true, id: "pages-router-scene" });
  expect(await readFile(path.join(root, "src/seene/catalog.js"), "utf8")).toContain("pages-router-scene.scene.json");
});

it("returns JSON diagnostics for duplicates, invalid payloads, cross-origin requests and production", async () => {
  const root = await nextProject();
  vi.stubEnv("NODE_ENV", "development");
  const created = await sceneRequest(root);
  expect(created.status, await created.clone().text()).toBe(200);
  const duplicate = await sceneRequest(root);
  expect(duplicate.status).toBe(409);
  expect(await duplicate.json()).toMatchObject({ error: expect.stringContaining("already exists") });

  const invalid = await handleNextScenePost(new Request("http://localhost/api/seene/create-scene", {
    method: "POST", headers: { "content-type": "application/json" }, body: "{bad json",
  }), root);
  expect(invalid.status).toBe(400);
  expect(await invalid.json()).toMatchObject({ error: "Scene request must contain valid JSON." });

  const crossOrigin = await handleNextScenePost(new Request("http://localhost/api/seene/create-scene", {
    method: "POST", headers: { origin: "http://attacker.invalid", "content-type": "application/json" }, body: "{}",
  }), root);
  expect(crossOrigin.status).toBe(403);

  vi.stubEnv("NODE_ENV", "production");
  const production = await sceneRequest(root, "production-blocked");
  expect(production.status).toBe(404);
  expect(await production.json()).toMatchObject({ error: "Scene creation is available only in development." });
  expect(await readFile(path.join(root, "src/seene/scenes/production-blocked.scene.json")).catch(() => undefined)).toBeUndefined();
});
