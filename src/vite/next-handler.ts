import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile, lstat } from "node:fs/promises";
import path from "node:path";
import { SceneRecipeSchema, SceneUpdateSchema } from "../core/recipes";
import { sceneComponentSource, validateHostComponent } from "../core/platform";
import { PlatformFault, writeSceneSourcePair, removeSceneSourcePair, discoverApplicationContent, updateSceneRecipe, componentImportSpecifier } from "./scene-files";

const maxBodyBytes = 256_000;
type Result = { status: number; body: { success?: true; id?: string; error?: string; warning?: string; content?: unknown } };
type ReadResult = { kind: "ok"; text: string } | { kind: "too-large" } | { kind: "unreadable" };

function json(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

async function readWebBody(request: Request): Promise<ReadResult> {
  if (Number(request.headers.get("content-length") ?? 0) > maxBodyBytes) return { kind: "too-large" };
  try {
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > maxBodyBytes) return { kind: "too-large" };
    return { kind: "ok", text };
  } catch {
    return { kind: "unreadable" };
  }
}

function readNodeBody(request: IncomingMessage): Promise<ReadResult> {
  return new Promise(resolve => {
    if (Number(request.headers["content-length"] ?? 0) > maxBodyBytes) {
      request.resume();
      resolve({ kind: "too-large" });
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    let oversized = false;
    request.on("data", (chunk: Buffer | string) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.byteLength;
      if (size > maxBodyBytes) { oversized = true; chunks.length = 0; }
      else if (!oversized) chunks.push(bytes);
    });
    request.on("end", () => resolve(oversized ? { kind: "too-large" } : { kind: "ok", text: Buffer.concat(chunks).toString("utf8") }));
    request.on("error", () => resolve({ kind: "unreadable" }));
  });
}

function jsonError(status: number, error: string): Result {
  return { status, body: { error } };
}

async function createScene(payload: unknown, root: string): Promise<Result> {
  if (process.env.NODE_ENV !== "development") return jsonError(404, "Scene creation is available only in development.");
  if (!payload || typeof payload !== "object" || !("id" in payload) || !("recipe" in payload) || typeof payload.id !== "string")
    return jsonError(400, "Missing scene id or recipe.");
  const input = payload as { id: string; recipe: unknown; hostPath?: string; content?: { file: string; export?: string }; sections?: Array<{ file: string; export?: string; id?: string; title?: string }> };
  const parsed = SceneRecipeSchema.safeParse(input.recipe);
  if (!parsed.success || parsed.data.id !== input.id)
    return jsonError(400, parsed.success
      ? `Scene id "${input.id}" does not match recipe id "${parsed.data.id}".`
      : parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; "));
  try {
    let warning: string | undefined = undefined;

    const rawSections: Array<{ file: string; export?: string; id?: string; title?: string }> =
      input.sections ?? (input.content ? [input.content] : input.hostPath ? [{ file: input.hostPath }] : []);
    const resolvedSections: Array<{ importSpecifier: string; export?: string; id?: string; title?: string }> = [];

    for (const sec of rawSections) {
      if (sec.file) {
        const targetFile = sec.file.trim();
        const absolute = path.resolve(root, targetFile);
        const stat = await lstat(absolute).catch(() => undefined);
        if (!stat?.isFile()) return jsonError(400, `Host component path "${targetFile}" does not exist.`);
        const source = await readFile(absolute, "utf8").catch(() => undefined);
        if (source === undefined) return jsonError(400, `Host component path "${targetFile}" could not be read.`);
        try {
          const val = validateHostComponent(targetFile, source, sec.export);
          if (val.warning) warning = val.warning;
        } catch (err: any) {
          return jsonError(400, err?.message || String(err));
        }
        resolvedSections.push({
          importSpecifier: componentImportSpecifier(targetFile),
          ...(sec.export ? { export: sec.export.trim() } : {}),
          ...(sec.id ? { id: sec.id } : {}),
          ...(sec.title ? { title: sec.title } : {}),
        });
      }
    }

    const compSource = sceneComponentSource({
      id: parsed.data.id,
      compositionType: parsed.data.definition.compositionType,
      sections: resolvedSections,
      ...(parsed.data.definition.walkthrough ? { walkthrough: parsed.data.definition.walkthrough } : {}),
    });
    const outcome = await writeSceneSourcePair(root, parsed.data.id, parsed.data, compSource);
    if (outcome === "exists") return jsonError(409, `Scene "${parsed.data.id}" already exists or has an incomplete source pair.`);
    return { status: 200, body: { success: true, id: parsed.data.id, ...(warning ? { warning } : {}) } };
  } catch (error) {
    if (error instanceof PlatformFault && error.code === "denied-path") return jsonError(400, error.message);
    return jsonError(500, error instanceof Error ? error.message : "Unable to create scene files.");
  }
}

async function deleteScene(payload: unknown, url?: string, root = process.cwd()): Promise<Result> {
  if (process.env.NODE_ENV !== "development") return jsonError(404, "Scene deletion is available only in development.");
  let id = payload && typeof payload === "object" && "id" in payload && typeof (payload as any).id === "string"
    ? (payload as { id: string }).id
    : undefined;

  if (!id && url) {
    try { id = new URL(url, "http://127.0.0.1").searchParams.get("id") ?? undefined; } catch {}
  }

  if (!id) return jsonError(400, "Missing scene id.");
  try {
    const removed = await removeSceneSourcePair(root, id);
    if (!removed) return jsonError(404, `Scene "${id}" not found.`);
    return { status: 200, body: { success: true, id } };
  } catch (error) {
    if (error instanceof PlatformFault && error.code === "invalid-input") return jsonError(400, error.message);
    return jsonError(500, error instanceof Error ? error.message : "Unable to delete scene files.");
  }
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try { return { ok: true, value: JSON.parse(text) as unknown }; }
  catch { return { ok: false }; }
}

function isSameOrigin(origin: string, targetHost: string, targetUrlOrigin: string): boolean {
  try {
    const originHost = new URL(origin).host;
    if (originHost === targetHost) return true;
    if (origin === targetUrlOrigin) return true;
    const normalize = (h: string) => h.replace(/^localhost(?=:|$)/, "127.0.0.1");
    return normalize(originHost) === normalize(targetHost);
  } catch {
    return false;
  }
}

export async function handleNextScenePost(request: Request, root = process.cwd()): Promise<Response> {
  try {
    if (request.method !== "POST") return Response.json({ error: "Use POST to create a scene." }, { status: 405, headers: { Allow: "POST" } });
    const origin = request.headers.get("origin");
    const host = request.headers.get("host") ?? new URL(request.url).host;
    if (origin && !isSameOrigin(origin, host, new URL(request.url).origin)) return Response.json({ error: "Cross-origin scene creation is not allowed." }, { status: 403 });
    const read = await readWebBody(request);
    if (read.kind === "too-large") return Response.json({ error: "Scene request is too large." }, { status: 413 });
    if (read.kind === "unreadable") return Response.json({ error: "Scene request could not be read." }, { status: 400 });
    const parsed = parseJson(read.text);
    if (!parsed.ok) return Response.json({ error: "Scene request must contain valid JSON." }, { status: 400 });
    const result = await createScene(parsed.value, root);
    return Response.json(result.body, { status: result.status });
  } catch (err: any) {
    return Response.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleNextScenePost(request);
}

export async function handleNextSceneDelete(request: Request, root = process.cwd()): Promise<Response> {
  try {
    if (request.method !== "DELETE") return Response.json({ error: "Use DELETE to remove a scene." }, { status: 405, headers: { Allow: "DELETE" } });
    const origin = request.headers.get("origin");
    const host = request.headers.get("host") ?? new URL(request.url).host;
    if (origin && !isSameOrigin(origin, host, new URL(request.url).origin)) return Response.json({ error: "Cross-origin scene deletion is not allowed." }, { status: 403 });
    const read = await readWebBody(request);
    const parsed = read.kind === "ok" ? parseJson(read.text) : { ok: false as const };
    const result = await deleteScene(parsed.ok ? parsed.value : undefined, request.url, root);
    return Response.json(result.body, { status: result.status });
  } catch (err: any) {
    return Response.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  return handleNextSceneDelete(request);
}

function contentFilters(search: URLSearchParams): { query: string; kinds?: Array<"page" | "section" | "component"> } {
  const kinds = (search.get("kind") ?? "").split(",")
    .map(value => value.trim())
    .filter((value): value is "page" | "section" | "component" => value === "page" || value === "section" || value === "component");
  return { query: search.get("q") ?? "", ...(kinds.length ? { kinds } : {}) };
}

export async function handleNextSceneGetContent(request: Request, root = process.cwd()): Promise<Response> {
  try {
    const content = await discoverApplicationContent(root, contentFilters(new URL(request.url).searchParams));
    return Response.json({ success: true, content });
  } catch (err: any) {
    return Response.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

export async function GET(request: Request): Promise<Response> {
  return handleNextSceneGetContent(request);
}

async function updateScene(payload: unknown, root: string): Promise<Result> {
  if (process.env.NODE_ENV !== "development") return jsonError(404, "Scene updates are available only in development.");
  const parsed = SceneUpdateSchema.safeParse(payload);
  if (!parsed.success) return jsonError(400, parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; "));
  try {
    const outcome = await updateSceneRecipe(root, parsed.data.id, parsed.data.recipe.definition);
    if (outcome === "not-found") return jsonError(404, `Scene "${parsed.data.id}" not found.`);
    return { status: 200, body: { success: true, id: parsed.data.id } };
  } catch (error) {
    if (error instanceof PlatformFault && error.code === "denied-path") return jsonError(400, error.message);
    return jsonError(400, error instanceof Error ? error.message : "Unable to update scene recipe.");
  }
}

export async function handleNextScenePut(request: Request, root = process.cwd()): Promise<Response> {
  try {
    if (request.method !== "PUT") return Response.json({ error: "Use PUT to update a scene." }, { status: 405, headers: { Allow: "PUT" } });
    const origin = request.headers.get("origin");
    const host = request.headers.get("host") ?? new URL(request.url).host;
    if (origin && !isSameOrigin(origin, host, new URL(request.url).origin)) return Response.json({ error: "Cross-origin scene updates are not allowed." }, { status: 403 });
    const read = await readWebBody(request);
    if (read.kind === "too-large") return Response.json({ error: "Scene update request is too large." }, { status: 413 });
    if (read.kind === "unreadable") return Response.json({ error: "Scene update request could not be read." }, { status: 400 });
    const parsed = parseJson(read.text);
    if (!parsed.ok) return Response.json({ error: "Scene update request must contain valid JSON." }, { status: 400 });
    const result = await updateScene(parsed.value, root);
    return Response.json(result.body, { status: result.status });
  } catch (err: any) {
    return Response.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

export async function PUT(request: Request): Promise<Response> {
  return handleNextScenePut(request);
}

export function createPagesHandler(request: IncomingMessage, response: ServerResponse, root = process.cwd()): void {
  if (request.method === "POST") {
    handlePagesScenePost(request, response, root);
  } else if (request.method === "PUT") {
    handlePagesScenePut(request, response, root);
  } else if (request.method === "DELETE") {
    handlePagesSceneDelete(request, response, root);
  } else if (request.method === "GET") {
    handlePagesSceneGetContent(request, response, root);
  } else {
    json(response, 405, { error: "Use POST to create a scene, PUT to update one, or DELETE to remove one." });
  }
}

function handlePagesScenePost(request: IncomingMessage, response: ServerResponse, root: string): void {
  if (request.headers.origin && request.headers.host && !isSameOrigin(request.headers.origin, request.headers.host, request.headers.origin)) { json(response, 403, { error: "Cross-origin scene creation is not allowed." }); return; }
  void (async () => {
    const read = await readNodeBody(request);
    if (read.kind === "too-large") { json(response, 413, { error: "Scene request is too large." }); return; }
    if (read.kind === "unreadable") { json(response, 400, { error: "Scene request could not be read." }); return; }
    const parsed = parseJson(read.text);
    if (!parsed.ok) { json(response, 400, { error: "Scene request must contain valid JSON." }); return; }
    const result = await createScene(parsed.value, root);
    json(response, result.status, result.body);
  })();
}

function handlePagesSceneDelete(request: IncomingMessage, response: ServerResponse, root: string): void {
  if (request.headers.origin && request.headers.host && !isSameOrigin(request.headers.origin, request.headers.host, request.headers.origin)) { json(response, 403, { error: "Cross-origin scene deletion is not allowed." }); return; }
  void (async () => {
    const read = await readNodeBody(request);
    const parsed = read.kind === "ok" ? parseJson(read.text) : { ok: false as const };
    const result = await deleteScene(parsed.ok ? parsed.value : undefined, request.url, root);
    json(response, result.status, result.body);
  })();
}

function handlePagesSceneGetContent(request: IncomingMessage, response: ServerResponse, root: string): void {
  void (async () => {
    try {
      const content = await discoverApplicationContent(root, contentFilters(new URL(request.url ?? "/", "http://127.0.0.1").searchParams));
      json(response, 200, { success: true, content });
    } catch (err: any) {
      json(response, 500, { error: err?.message || String(err) });
    }
  })();
}

function handlePagesScenePut(request: IncomingMessage, response: ServerResponse, root: string): void {
  if (request.headers.origin && request.headers.host && !isSameOrigin(request.headers.origin, request.headers.host, request.headers.origin)) { json(response, 403, { error: "Cross-origin scene updates are not allowed." }); return; }
  void (async () => {
    const read = await readNodeBody(request);
    if (read.kind === "too-large") { json(response, 413, { error: "Scene update request is too large." }); return; }
    if (read.kind === "unreadable") { json(response, 400, { error: "Scene update request could not be read." }); return; }
    const parsed = parseJson(read.text);
    if (!parsed.ok) { json(response, 400, { error: "Scene update request must contain valid JSON." }); return; }
    const result = await updateScene(parsed.value, root);
    json(response, result.status, result.body);
  })();
}
