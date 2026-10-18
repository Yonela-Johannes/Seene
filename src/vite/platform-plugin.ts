import { mkdir, readFile, realpath, rename, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, ViteDevServer, PreviewServer } from "vite";
import { ProjectStateSchema } from "../core/project";
import type { SceneIssue } from "../core/scene";
import {
  PLATFORM_API_PREFIX, PLATFORM_REGISTRY_FILE, PlatformErrorSchema, PlatformProjectSchema,
  PlatformProjectsSchema, PlatformCatalogResponseSchema, PlatformContentResponseSchema,
  PlatformSceneResponseSchema, PlatformStatusSchema, CreateSceneRequestSchema, DuplicateSceneRequestSchema, RemoveSceneRequestSchema,
  PlatformSourceInspectRequestSchema, PlatformSourcesResponseSchema, PlatformBrowseResponseSchema,
  RegisterProjectSchema, analyzeApplicationModule, applicationRouteForContent, createSceneRecipe, isAllowedDevOrigin,
  isApplicationSourcePath, isDocumentApplication, isLoopbackHost, issueFor,
  loadProjectRegistry, platformHome, previewUrl, registryWithout, sceneComponentSource, summarizeCatalog,
  type PlatformProject, type ProjectEntry, type SceneDraft,
} from "../core/platform";
import { SCENE_RECIPE_DIRECTORY } from "../core/recipes";
import {
  PlatformFault, browseSourceDirectories, componentImportSpecifier, discoverApplicationContent, duplicateSceneSourcePair,
  inspectSource, invalidateApplicationScan, readSceneCatalog, removeSceneSourcePair, resolveProjectTarget, writeSceneSourcePair,
} from "./scene-files";

const maxBodyBytes = 128_000;
const loopbackOrigin = /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]+)?\/?$/;
const packageManagers = ["npm", "pnpm", "yarn", "bun"] as const;
const lockfiles: Record<string, typeof packageManagers[number]> = {
  "package-lock.json": "npm", "npm-shrinkwrap.json": "npm", "pnpm-lock.yaml": "pnpm",
  "yarn.lock": "yarn", "bun.lock": "bun", "bun.lockb": "bun",
};

function send(response: ServerResponse, status: number, value: unknown): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(value));
}
function fail(response: ServerResponse, status: number, error: string): void {
  send(response, status, PlatformErrorSchema.parse({ error }));
}
function statusFor(error: unknown): number {
  const code = error instanceof Error && "code" in error ? String((error as { code: unknown }).code) : "";
  return code === "denied-path" || code === "invalid-input" ? 400 : code === "not-found" ? 404 : code === "conflict" ? 409 : 500;
}

function collect(request: IncomingMessage): Promise<string | undefined> {
  return new Promise(resolve => {
    let body = "";
    let bytes = 0;
    let oversized = false;
    request.on("data", chunk => {
      bytes += chunk.length;
      if (bytes > maxBodyBytes) { oversized = true; body = ""; return; }
      if (!oversized) body += chunk;
    });
    request.on("end", () => resolve(oversized ? undefined : body));
    request.on("error", () => resolve(undefined));
  });
}
async function body(request: IncomingMessage): Promise<unknown> {
  const text = await collect(request);
  if (text === undefined) throw new PlatformFault("invalid-input", "Request body is too large or unreadable.");
  try { return JSON.parse(text); }
  catch { throw new PlatformFault("invalid-input", "Request body must be valid JSON."); }
}
async function readJson(target: string): Promise<unknown> {
  return JSON.parse(await readFile(target, "utf8")) as unknown;
}

export function seenePlatformPlugin(): Plugin {
  const mount = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use(createHandler({ platformRoot: path.resolve(server.config.root) }));
  };
  return {
    name: "seene-platform",
    configureServer(server) { mount(server); },
    configurePreviewServer(server) { mount(server); },
  };
}

type PlatformHome = { directory: string; registryPath: string };

function homeFor(): PlatformHome {
  const directory = platformHome(process.env.SEENE_HOME, homedir());
  return { directory: path.resolve(directory), registryPath: path.resolve(directory, PLATFORM_REGISTRY_FILE) };
}

async function loadRegistry(home: PlatformHome): Promise<ProjectEntry[]> {
  const text = await readFile(home.registryPath, "utf8").catch(() => undefined);
  return loadProjectRegistry(text).projects;
}

async function saveRegistry(home: PlatformHome, entries: ProjectEntry[]): Promise<void> {
  await mkdir(home.directory, { recursive: true });
  const temporary = `${home.registryPath}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(temporary, JSON.stringify({ version: 1, projects: entries }, null, 2) + "\n", "utf8");
  await rename(temporary, home.registryPath);
}

type Manifest = { name?: unknown; packageManager?: unknown; dependencies?: Record<string, unknown>; devDependencies?: Record<string, unknown> };

async function inspectProject(root: string, entry: ProjectEntry): Promise<{ react: boolean; project: PlatformProject }> {
  const issues: SceneIssue[] = [];
  let name = entry.name;
  let packageManager: PlatformProject["packageManager"];
  let react = false;
  const manifest = await readJson(path.join(root, "package.json")).catch(() => undefined) as Manifest | undefined;
  if (!manifest) issues.push({ path: "package.json", message: "This folder has no package.json. Choose the folder that contains your React application." });
  else {
    if (typeof manifest.name === "string" && manifest.name.trim()) name = manifest.name.trim();
    const declared = typeof manifest.packageManager === "string" ? manifest.packageManager.split(/[@/]/)[0] : "";
    if ((packageManagers as readonly string[]).includes(declared)) packageManager = declared as PlatformProject["packageManager"];
    react = typeof { ...manifest.dependencies, ...manifest.devDependencies }.react === "string";
  }
  if (!packageManager) {
    for (const [file, manager] of Object.entries(lockfiles)) {
      if (await stat(path.join(root, file)).then(() => true, () => false)) { packageManager = manager; break; }
    }
  }
  let recorded;
  const stateText = await readFile(path.join(root, ".seene", "project.json"), "utf8").catch(() => undefined);
  if (stateText === undefined) issues.push({ path: ".seene/project.json", message: "Not connected yet. Run pnpm exec seene init in this project, then refresh." });
  else {
    try { recorded = ProjectStateSchema.parse(JSON.parse(stateText)); }
    catch { issues.push({ path: ".seene/project.json", message: "Seene setup cannot be read. Run pnpm exec seene init in this project." }); }
  }
  const catalog = await readSceneCatalog(root).catch(error => ({ scenes: [], issues: [issueFor(error, SCENE_RECIPE_DIRECTORY)] }));
  const updatedAt = await stat(path.join(root, SCENE_RECIPE_DIRECTORY)).then(info => info.mtime.toISOString(), () => undefined);
  const resolvedManager = recorded?.packageManager ?? packageManager;
  return {
    react,
    project: PlatformProjectSchema.parse({
      path: root, name, connected: recorded !== undefined, sceneDirectory: SCENE_RECIPE_DIRECTORY,
      sceneCount: catalog.scenes.length, addedAt: entry.addedAt, issues: [...issues, ...catalog.issues],
      ...(updatedAt ? { updatedAt } : {}), ...(resolvedManager ? { packageManager: resolvedManager } : {}),
      ...(recorded?.entry ? { entry: recorded.entry } : {}), ...(recorded?.adapter ? { adapter: recorded.adapter } : {}),
    }),
  };
}

type Parser<T> = { safeParse: (value: unknown) => unknown };
function parse<T>(schema: Parser<T>, value: unknown): T {
  const result = schema.safeParse(value) as { success: boolean; data?: T; error?: { issues: { message: string }[] } };
  if (!result.success) throw new PlatformFault("invalid-input", (result.error?.issues ?? []).map(issue => issue.message).join("; ") || "Invalid request.");
  return result.data as T;
}

async function listProjects(entries: ProjectEntry[]): Promise<PlatformProject[]> {
  const inspected = await Promise.all(entries.map(async entry => (await inspectProject(entry.path, entry).catch(() => undefined))?.project));
  return inspected.filter((project): project is PlatformProject => project !== undefined);
}

function createHandler(options: { platformRoot?: string }) {
  const home = homeFor();
  return (request: IncomingMessage, response: ServerResponse, next: (error?: Error) => void): void => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (!requestUrl.pathname.startsWith(PLATFORM_API_PREFIX)) { next(); return; }
    const route = requestUrl.pathname.slice(PLATFORM_API_PREFIX.length) || "/";
    void (async () => {
      try {
        const entries = await loadRegistry(home);
        const locate = async (target: unknown): Promise<ProjectEntry> => {
          if (typeof target !== "string" || !target.trim()) throw new PlatformFault("invalid-input", "Provide the project folder to operate on.");
          const resolved = path.resolve(target.trim());
          const entry = entries.find(item => item.path === resolved);
          if (!entry) throw new PlatformFault("not-found", "Add this project to Seene before working with its scenes.");
          return entry;
        };
        if (route === "/projects") {
          if (request.method === "GET") return void send(response, 200, PlatformProjectsSchema.parse({ home: home.directory, projects: await listProjects(entries) }));
          if (request.method === "POST") {
            const input = parse<{ path: string }>(RegisterProjectSchema, await body(request));
            const target = await realpath(path.resolve(input.path)).catch(() => undefined);
            if (!target) throw new PlatformFault("not-found", "That folder does not exist. Check the path and try again.");
            if (!(await stat(target)).isDirectory()) throw new PlatformFault("invalid-input", "Choose the folder that contains your React application.");
            if (options.platformRoot && (target === options.platformRoot || options.platformRoot.startsWith(target + path.sep)))
              throw new PlatformFault("invalid-input", "Seene's own platform is not a project. Register the React application you want to present.");
            const facts = await inspectProject(target, { path: target, name: path.basename(target), addedAt: new Date().toISOString() });
            if (!facts.react) throw new PlatformFault("invalid-input", `${facts.project.name} does not depend on react. Add react and react-dom to its package.json, then register it again.`);
            const next_ = entries.some(entry => entry.path === target) ? entries
              : [...entries, { path: target, name: facts.project.name, addedAt: new Date().toISOString() }];
            await saveRegistry(home, next_);
            invalidateApplicationScan(target);
            return void send(response, 200, PlatformProjectsSchema.parse({ home: home.directory, projects: await listProjects(next_) }));
          }
          if (request.method === "DELETE") {
            const input = parse<{ path: string }>(RegisterProjectSchema, await body(request));
            const next_ = registryWithout(path.resolve(input.path), entries).projects;
            await saveRegistry(home, next_);
            return void send(response, 200, PlatformProjectsSchema.parse({ home: home.directory, projects: await listProjects(next_) }));
          }
        }
        if (route === "/projects/scenes") {
          if (request.method === "GET") {
            const entry = await locate(requestUrl.searchParams.get("path"));
            const catalog = await readSceneCatalog(entry.path);
            const { project } = await inspectProject(entry.path, entry);
            return void send(response, 200, PlatformCatalogResponseSchema.parse({ project, catalog: summarizeCatalog(catalog) }));
          }
          if (request.method === "POST") {
            const input = parse<{ path: string } & SceneDraft>(CreateSceneRequestSchema, await body(request));
            const entry = await locate(input.path);
            const { project } = await inspectProject(entry.path, entry);

            const rawSelections = input.sections ?? (input.content ? [input.content] : []);
            const resolvedSections: Array<{ id: string; title: string; file: string; importSpecifier: string; export?: string }> = [];

            for (let i = 0; i < rawSelections.length; i++) {
              const sel = rawSelections[i];
              if (!isApplicationSourcePath(sel.file))
                throw new PlatformFault("invalid-input", `Choose a component file inside src/ that is not a Seene scene: ${sel.file}`);
              const absolute = await resolveProjectTarget(entry.path, sel.file).catch(() => undefined);
              const source = absolute ? await readFile(absolute, "utf8").catch(() => undefined) : undefined;
              if (source === undefined) throw new PlatformFault("not-found", `${sel.file} is no longer part of this project.`);
              const analysis = analyzeApplicationModule(source);
              if (sel.export && !analysis.exports.includes(sel.export))
                throw new PlatformFault("invalid-input", `${sel.file} does not export ${sel.export}.`);
              if (!sel.export && !analysis.default)
                throw new PlatformFault("invalid-input", `${sel.file} has no default export; choose one of its named exports instead.`);

              const basename = sel.file.split("/").pop()?.replace(/\.[jt]sx$/, "") || `section-${i + 1}`;
              const formattedTitle = (sel.export && sel.export !== "default" ? sel.export : basename).replace(/([a-z])([A-Z])/g, "$1 $2");

              resolvedSections.push({
                id: `sec-${i + 1}-${sel.export || basename.toLowerCase()}`,
                title: formattedTitle,
                file: sel.file,
                importSpecifier: componentImportSpecifier(sel.file),
                ...(sel.export ? { export: sel.export } : {}),
              });
            }

            const primaryRoute = rawSelections.length > 0
              ? applicationRouteForContent(rawSelections[0].file, rawSelections[0].export)
              : (isDocumentApplication(project.adapter) ? "/" : undefined);

            const recipe = createSceneRecipe({
              id: input.id,
              title: input.title,
              ...(input.description ? { description: input.description } : {}),
              ...(primaryRoute ? { applicationRoute: primaryRoute } : {}),
              compositionType: input.compositionType ?? (rawSelections.length > 1 ? "walkthrough" : "scene"),
              sections: resolvedSections.map(s => ({ id: s.id, title: s.title, file: s.file, ...(s.export ? { export: s.export } : {}) })),
              width: input.width,
              height: input.height,
            });

            const compSource = sceneComponentSource({
              id: input.id,
              compositionType: recipe.definition.compositionType,
              sections: resolvedSections,
              ...(recipe.definition.walkthrough ? { walkthrough: recipe.definition.walkthrough } : {}),
            });

            if (await writeSceneSourcePair(entry.path, input.id, recipe, compSource) === "exists")
              throw new PlatformFault("conflict", `Scene "${input.id}" already exists in this project. Choose another name.`);
            invalidateApplicationScan(entry.path);
            const catalog = summarizeCatalog(await readSceneCatalog(entry.path));
            const scene = catalog.scenes.find(item => item.id === input.id);
            if (!scene) throw new PlatformFault("conflict", "The scene was written but cannot be discovered. Check the recipe and its component.");
            return void send(response, 200, PlatformSceneResponseSchema.parse({ project, scene, catalog }));
          }
          if (request.method === "DELETE") {
            const input = parse<{ path: string; id: string }>(RemoveSceneRequestSchema, await body(request));
            const entry = await locate(input.path);
            if (!await removeSceneSourcePair(entry.path, input.id)) throw new PlatformFault("not-found", `Scene "${input.id}" is not part of this project.`);
            invalidateApplicationScan(entry.path);
            const catalog = summarizeCatalog(await readSceneCatalog(entry.path));
            const { project } = await inspectProject(entry.path, entry);
            return void send(response, 200, PlatformCatalogResponseSchema.parse({ project, catalog }));
          }
        }
        if (route === "/projects/scenes/duplicate" && request.method === "POST") {
          const input = parse<{ path: string; id: string; newId: string }>(DuplicateSceneRequestSchema, await body(request));
          const entry = await locate(input.path);
          const status = await duplicateSceneSourcePair(entry.path, input.id, input.newId);
          if (status === "not-found") throw new PlatformFault("not-found", `Scene "${input.id}" is not part of this project.`);
          if (status === "exists") throw new PlatformFault("conflict", `Scene "${input.newId}" already exists. Choose another name.`);
          invalidateApplicationScan(entry.path);
          const catalog = summarizeCatalog(await readSceneCatalog(entry.path));
          const { project } = await inspectProject(entry.path, entry);
          return void send(response, 200, PlatformCatalogResponseSchema.parse({ project, catalog }));
        }
        if (route === "/projects/content" && request.method === "GET") {
          const entry = await locate(requestUrl.searchParams.get("path"));
          const query = requestUrl.searchParams.get("q") ?? "";
          const kinds = (requestUrl.searchParams.get("kind") ?? "").split(",")
            .map(value => value.trim())
            .filter((value): value is "page" | "section" | "component" => value === "page" || value === "section" || value === "component");
          const content = await discoverApplicationContent(entry.path, { query, ...(kinds.length ? { kinds } : {}) });
          const { project } = await inspectProject(entry.path, entry);
          return void send(response, 200, PlatformContentResponseSchema.parse({ project, content }));
        }
        if (route === "/projects/sources/inspect" && request.method === "POST") {
          if (!isLoopbackHost(request.headers.host)) throw new PlatformFault("denied-path", "Source browsing is limited to this machine.");
          const input = parse<{ path: string }>(PlatformSourceInspectRequestSchema, await body(request));
          const source = await inspectSource(input.path);
          const registered = entries.some(entry => path.resolve(entry.path) === path.resolve(source.path));
          return void send(response, 200, PlatformSourcesResponseSchema.parse({ home: home.directory, source: { ...source, registered } }));
        }
        if (route === "/projects/sources/browse" && request.method === "GET") {
          if (!isLoopbackHost(request.headers.host)) throw new PlatformFault("denied-path", "Source browsing is limited to this machine.");
          const result = await browseSourceDirectories(requestUrl.searchParams.get("path") ?? undefined);
          return void send(response, 200, PlatformBrowseResponseSchema.parse(result));
        }
        if (route === "/projects/status" && request.method === "GET") {
          const entry = await locate(requestUrl.searchParams.get("path"));
          const origin = requestUrl.searchParams.get("origin") ?? "";
          if (!isAllowedDevOrigin(origin))
            throw new PlatformFault("invalid-input", "Use a valid local development origin, for example http://localhost:3000 or http://127.0.0.1:5173.");
          const { project } = await inspectProject(entry.path, entry);
          const url = previewUrl(project.adapter, origin);
          let reachable = false;
          try { reachable = (await fetch(url, { signal: AbortSignal.timeout(4000) })).ok; } catch { reachable = false; }
          return void send(response, 200, PlatformStatusSchema.parse({ origin, url, reachable,
            message: reachable ? "Your application is connected. Preview is live." : `Nothing answered at ${origin}. Start this project's own development server, then retry.` }));
        }
        fail(response, 404, "Unknown Seene platform request.");
      } catch (error) {
        fail(response, statusFor(error), error instanceof Error ? error.message : "The platform request failed.");
      }
    })();
  };
}
