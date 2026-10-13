import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { PassThrough } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import { handleNextScenePut, createPagesHandler } from "../../src/vite/next-handler";

const roots: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

function recipe(id: string, backdrop?: string) {
  const definition: Record<string, unknown> = { scene: { version: 3 as const, nodes: [{ id: "host" }] } };
  if (backdrop !== undefined) definition.backdrop = backdrop;
  return JSON.stringify({ version: 1, id, title: `${id} scene`, definition }, null, 2) + "\n";
}

async function seedScene(root: string, id = "demo") {
  const dir = path.join(root, "src/seene/scenes");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${id}.scene.json`), recipe(id));
  await writeFile(path.join(dir, `${id}.tsx`), `"use client"; export default function Demo(){return null}`);
}

function putRequest(backdrop = "#ff0000", origin = "http://localhost", id = "demo") {
  return new Request("http://localhost/api/seene/create-scene", {
    method: "PUT",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ id, recipe: { definition: { backdrop } } }),
  });
}

it("updates an existing scene recipe backdrop via PUT and persists to disk", async () => {
  vi.stubEnv("NODE_ENV", "development");
  const root = await mkdtemp(path.join(os.tmpdir(), "seene-put-"));
  roots.push(root);
  await seedScene(root, "demo");

  const response = await handleNextScenePut(putRequest(), root);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ success: true, id: "demo" });
  const onDisk = JSON.parse(await readFile(path.join(root, "src/seene/scenes/demo.scene.json"), "utf8"));
  expect(onDisk.definition.backdrop).toBe("#ff0000");
});

it("returns 404 when updating a scene that does not exist", async () => {
  vi.stubEnv("NODE_ENV", "development");
  const root = await mkdtemp(path.join(os.tmpdir(), "seene-put-"));
  roots.push(root);
  const response = await handleNextScenePut(putRequest(), root);
  expect(response.status).toBe(404);
  expect(await response.json()).toMatchObject({ error: expect.stringContaining("not found") });
});

it("returns 400 for an invalid PUT payload", async () => {
  vi.stubEnv("NODE_ENV", "development");
  const root = await mkdtemp(path.join(os.tmpdir(), "seene-put-"));
  roots.push(root);
  const response = await handleNextScenePut(new Request("http://localhost/api/seene/create-scene", {
    method: "PUT",
    headers: { origin: "http://localhost", "content-type": "application/json" },
    body: JSON.stringify({ id: "demo" }),
  }), root);
  expect(response.status).toBe(400);
});

it("returns 404 in production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  const root = await mkdtemp(path.join(os.tmpdir(), "seene-put-"));
  roots.push(root);
  const response = await handleNextScenePut(putRequest(), root);
  expect(response.status).toBe(404);
});

it("rejects cross-origin PUT requests", async () => {
  vi.stubEnv("NODE_ENV", "development");
  const root = await mkdtemp(path.join(os.tmpdir(), "seene-put-"));
  roots.push(root);
  const response = await handleNextScenePut(putRequest("#ff0000", "http://attacker.invalid"), root);
  expect(response.status).toBe(403);
});

it("rejects method other than PUT", async () => {
  vi.stubEnv("NODE_ENV", "development");
  const root = await mkdtemp(path.join(os.tmpdir(), "seene-put-"));
  roots.push(root);
  const response = await handleNextScenePut(new Request("http://localhost/api/seene/create-scene", {
    method: "POST",
    headers: { origin: "http://localhost", "content-type": "application/json" },
    body: "{}",
  }), root);
  expect(response.status).toBe(405);
});

it("handles the Next.js Pages Router Node request stream for PUT", async () => {
  vi.stubEnv("NODE_ENV", "development");
  const root = await mkdtemp(path.join(os.tmpdir(), "seene-put-"));
  roots.push(root);
  await seedScene(root, "pages-put");
  const request = new PassThrough() as PassThrough & Partial<IncomingMessage>;
  Object.assign(request, { method: "PUT", headers: { host: "localhost", origin: "http://localhost" } });
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
  request.end(JSON.stringify({ id: "pages-put", recipe: { definition: { backdrop: "#123456" } } }));
  await completed;
  expect(status).toBe(200);
  expect(JSON.parse(body)).toMatchObject({ success: true, id: "pages-put" });
  const onDisk = JSON.parse(await readFile(path.join(root, "src/seene/scenes/pages-put.scene.json"), "utf8"));
  expect(onDisk.definition.backdrop).toBe("#123456");
});
