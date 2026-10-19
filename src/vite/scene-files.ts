import { lstat, mkdir, readFile, readdir, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { SCENE_RECIPE_DIRECTORY, type SceneCatalog, type SceneRecipe, SceneRecipeSchema } from "../core/recipes";
import type { PreviewDefinitionInput } from "../core/preview";
import { RESOURCES } from "../core/resources";
import { analyzeApplicationModule, applicationFileReadiness, classifyApplicationUnit, componentImportSpecifier, isApplicationSourcePath, isIconOrPrimitive, sceneComponentName, sceneComponentSource, type PlatformContent, type PlatformContentFile, type PlatformDirectoryEntry, type PlatformDiscoveredProject, type PlatformSource } from "../core/platform";
import { ProjectStateSchema } from "../core/project";
import { portableCatalog } from "../project/portable";
import type { SceneIssue } from "../core/scene";

export class PlatformFault extends Error {
  code: string;
  target: string;
  constructor(code: string, message: string, target = "") {
    super(message);
    this.name = "PlatformFault";
    this.code = code;
    this.target = target;
  }
}

const protectedParts = new Set([".git", "node_modules"]);
const maxRecipeBytes = 256_000;
const maxSourceBytes = 64_000;

export async function resolveProjectTarget(root: string, target: string): Promise<string> {
  if (path.isAbsolute(target)) throw new PlatformFault("denied-path", "Use a project-relative path.", target);
  const relative = target.replace(/^[/\\]+/, "");
  if (!relative) throw new PlatformFault("denied-path", "Use a project-relative path.", target);
  const base = path.resolve(root);
  const absolute = path.resolve(base, relative);
  if (absolute !== base && !absolute.startsWith(base + path.sep)) throw new PlatformFault("denied-path", "Path escapes the project root.", target);
  const parts = path.relative(base, absolute).split(path.sep).filter(Boolean);
  if (parts.some(part => protectedParts.has(part))) throw new PlatformFault("denied-path", "Path enters a protected directory.", target);
  let current = base;
  for (const part of parts) {
    current = path.join(current, part);
    const entry = await lstat(current).catch(error => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    });
    if (entry?.isSymbolicLink()) throw new PlatformFault("denied-path", "Symlinked targets are refused.", target);
  }
  return absolute;
}

async function readScoped(root: string, target: string, limit: number): Promise<string | undefined> {
  const absolute = await resolveProjectTarget(root, target);
  const entry = await lstat(absolute).catch(() => undefined);
  if (!entry?.isFile() || entry.size > limit) return undefined;
  return readFile(absolute, "utf8");
}

export async function readSceneCatalog(root: string, sceneId?: string): Promise<SceneCatalog> {
  const directory = await resolveProjectTarget(root, SCENE_RECIPE_DIRECTORY).catch(() => undefined);
  const entries = directory ? await readdir(directory, { withFileTypes: true }).catch(() => []) : [];
  const sources: { path: string; document: unknown }[] = [];
  const bindingPaths: string[] = [];
  const issues: SceneIssue[] = [];
  for (const entry of entries.slice(0, 256)) {
    if (!entry.isFile()) continue;
    const relative = `${SCENE_RECIPE_DIRECTORY}/${entry.name}`;
    if (/\.[jt]sx$/.test(entry.name)) { bindingPaths.push(relative); continue; }
    if (!entry.name.endsWith(".scene.json")) continue;
    const text = await readScoped(root, relative, maxRecipeBytes);
    if (text === undefined) { issues.push({ path: relative, message: "Recipe disappeared during discovery. Restore it or refresh the scene list." }); continue; }
    try { sources.push({ path: relative, document: JSON.parse(text) }); }
    catch { issues.push({ path: relative, message: "Invalid recipe JSON. Correct its syntax and reload the scene list." }); }
  }
  const catalog = RESOURCES["resolve-recipes"]({ sources, bindingPaths, ...(sceneId === undefined ? {} : { sceneId }) });
  return { ...catalog, issues: [...issues, ...catalog.issues].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0) };
}

async function replaceIfUnchanged(root: string, target: string, before: string, after: string): Promise<void> {
  const absolute = await resolveProjectTarget(root, target);
  const current = await readFile(absolute, "utf8").catch(() => undefined);
  if (current !== before) throw new PlatformFault("conflict", "Generated catalog changed during scene creation; run npx seene sync to recover.", target);
  const temporary = `${absolute}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(temporary, after, { encoding: "utf8", flag: "wx" });
  const checked = await readFile(absolute, "utf8").catch(() => undefined);
  if (checked !== before) { await rm(temporary, { force: true }); throw new PlatformFault("conflict", "Generated catalog changed during scene creation; run npx seene sync to recover.", target); }
  await rename(temporary, absolute);
}

import { createHash } from "node:crypto";

// Note: SHA-256 hash covers the entire file content including the scaffold version marker line.
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export async function syncCatalog(root: string): Promise<void> {
  const catalogTarget = "src/seene/catalog.js";
  const catalogPath = await resolveProjectTarget(root, catalogTarget).catch(() => undefined);
  if (!catalogPath) return;
  const exists = await lstat(catalogPath).then(stat => stat.isFile(), () => false);
  if (!exists) return;

  const catalog = await readSceneCatalog(root).catch(() => undefined);
  if (!catalog) return;
  const catalogText = portableCatalog(catalog.scenes);
  const before = await readFile(catalogPath, "utf8");
  if (catalogText === before) return;

  const manifestPath = ".seene/integration.json";
  const manifestText = await readFile(await resolveProjectTarget(root, manifestPath), "utf8").catch(error => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  });
  if (manifestText === undefined) {
    await replaceIfUnchanged(root, catalogTarget, before, catalogText);
    return;
  }

  let manifest: { version?: unknown; files?: Record<string, unknown> };
  try { manifest = JSON.parse(manifestText) as typeof manifest; }
  catch { throw new PlatformFault("invalid-file", "Cannot safely refresh the generated catalog because .seene/integration.json is invalid.", manifestPath); }
  if (!manifest.files || typeof manifest.files[catalogTarget] !== "string")
    throw new PlatformFault("conflict", "The generated catalog is not recorded as a managed Seene file; run seene init to repair the connection.", manifestPath);

  const recordedValue = manifest.files[catalogTarget] as string;
  const recordedHash = /^[a-f0-9]{64}$/i.test(recordedValue.trim())
    ? recordedValue.trim().toLowerCase()
    : sha256(recordedValue);

  if (recordedHash !== sha256(before))
    throw new PlatformFault("conflict", "The generated catalog was edited outside Seene; run npx seene sync to review and recover.", catalogTarget);

  const pendingTarget = ".seene/catalog-pending.json";
  const pendingPath = await resolveProjectTarget(root, pendingTarget);
  if (await lstat(pendingPath).then(() => true, () => false))
    throw new PlatformFault("conflict", "A previous catalog refresh was interrupted; run npx seene sync to recover it.", pendingTarget);
  const journal = JSON.stringify({ before, after: catalogText });
  await writeFile(pendingPath, journal, { encoding: "utf8", flag: "wx" });
  await replaceIfUnchanged(root, catalogTarget, before, catalogText);
  manifest.files[catalogTarget] = sha256(catalogText);
  await replaceIfUnchanged(root, manifestPath, manifestText, JSON.stringify(manifest, null, 2) + "\n");
  await rm(pendingPath, { force: true });
}

export async function writeSceneSourcePair(root: string, id: string, recipe: SceneRecipe, componentSource: string): Promise<"created" | "exists"> {
  const directory = await resolveProjectTarget(root, SCENE_RECIPE_DIRECTORY);
  const recipePath = path.join(directory, `${id}.scene.json`);
  const bindingPath = path.join(directory, `${id}.tsx`);
  const exists = (target: string) => lstat(target).then(() => true, () => false);
  if (await exists(recipePath) || await exists(bindingPath)) return "exists";
  await mkdir(directory, { recursive: true });
  let componentCreated = false;
  let recipeCreated = false;
  try {
    await writeFile(bindingPath, componentSource, { encoding: "utf8", flag: "wx" });
    componentCreated = true;
    await writeFile(recipePath, JSON.stringify(recipe, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
    recipeCreated = true;
  } catch (error) {
    if (recipeCreated) await rm(recipePath, { force: true });
    if (componentCreated) await rm(bindingPath, { force: true });
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return "exists";
    throw error;
  }
  await syncCatalog(root);
  return "created";
}

export async function removeSceneSourcePair(root: string, id: string): Promise<boolean> {
  if (!id || typeof id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new PlatformFault("invalid-input", `Invalid scene ID: "${id}". Scene IDs must be lowercase alphanumeric with hyphens.`);
  }
  const directory = await resolveProjectTarget(root, SCENE_RECIPE_DIRECTORY);
  const recipePath = path.join(directory, `${id}.scene.json`);
  const tsxPath = path.join(directory, `${id}.tsx`);
  const jsxPath = path.join(directory, `${id}.jsx`);
  const removed = await lstat(recipePath).then(() => true, () => false);
  await rm(recipePath, { force: true });
  await rm(tsxPath, { force: true });
  await rm(jsxPath, { force: true });
  if (removed) await syncCatalog(root);
  return removed;
}

export async function duplicateSceneSourcePair(root: string, id: string, newId: string): Promise<"created" | "exists" | "not-found"> {
  const directory = await resolveProjectTarget(root, SCENE_RECIPE_DIRECTORY);
  const recipePath = path.join(directory, `${id}.scene.json`);
  const bindingPath = path.join(directory, `${id}.tsx`);
  const newRecipePath = path.join(directory, `${newId}.scene.json`);
  const newBindingPath = path.join(directory, `${newId}.tsx`);

  const exists = (target: string) => lstat(target).then(() => true, () => false);
  if (!await exists(recipePath)) return "not-found";
  if (await exists(newRecipePath) || await exists(newBindingPath)) return "exists";

  const recipeText = await readFile(recipePath, "utf8").catch(() => undefined);
  const bindingText = await readFile(bindingPath, "utf8").catch(() => undefined);
  if (!recipeText || !bindingText) return "not-found";

  let parsed: SceneRecipe;
  try {
    parsed = JSON.parse(recipeText) as SceneRecipe;
  } catch {
    return "not-found";
  }

  parsed.id = newId;
  parsed.title = `${parsed.title} (Copy)`;

  const newBindingText = bindingText.replace(new RegExp(`\\b${sceneComponentName(id)}\\b`, "g"), sceneComponentName(newId));

  await mkdir(directory, { recursive: true });
  await writeFile(newBindingPath, newBindingText, "utf8");
  await writeFile(newRecipePath, JSON.stringify(parsed, null, 2), "utf8");
  await syncCatalog(root);
  return "created";
}

async function loadTsconfigPaths(root: string): Promise<Record<string, string[]>> {
  const text = await readScoped(root, "tsconfig.json", 64_000)
    ?? await readScoped(root, "jsconfig.json", 64_000);
  if (!text) return {};
  try {
    const cleaned = text.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
    const parsed = JSON.parse(cleaned) as { compilerOptions?: { paths?: Record<string, string[]> } };
    return parsed.compilerOptions?.paths ?? {};
  } catch {
    return {};
  }
}

export function resolveAliasSpecifier(specifier: string, paths: Record<string, string[]>): string | undefined {
  for (const [pattern, targets] of Object.entries(paths)) {
    const prefix = pattern.replace(/\*$/, "");
    if (specifier.startsWith(prefix) && targets.length > 0) {
      const remainder = specifier.slice(prefix.length);
      const targetPrefix = targets[0].replace(/^\.\//, "").replace(/\*$/, "");
      return `${targetPrefix}${remainder}`;
    }
  }
  if (specifier.startsWith("@/")) {
    return `src/${specifier.slice(2)}`;
  }
  return undefined;
}

export type ApplicationScanOptions = {
  /** Free text matched against path, title, route and export names. */
  query?: string;
  /** Restrict to page, section or component classifications. */
  kinds?: Array<"page" | "section" | "component">;
  limit?: number;
};

/** Filter discovered files by free text and component kind. Pure so the console, the server
 * and tests share exactly one definition of what a search matches. */
export function filterApplicationContent(
  files: PlatformContentFile[],
  query = "",
  kinds?: Array<"page" | "section" | "component">,
): PlatformContentFile[] {
  const needle = query.trim().toLowerCase();
  return files.filter(file => {
    if (kinds && kinds.length > 0 && (!file.kind || !kinds.includes(file.kind))) return false;
    if (!needle) return true;
    const haystack = `${file.path} ${file.title ?? ""} ${file.route ?? ""} ${file.exports.join(" ")}`.toLowerCase();
    return haystack.includes(needle);
  });
}

const SCAN_CACHE_TTL_MS = 2000;
const scanCache = new Map<string, { at: number; content: PlatformContent }>();

/** Drop cached scan results after writes so the next read sees the change. */
export function invalidateApplicationScan(root?: string): void {
  if (root === undefined) scanCache.clear();
  else scanCache.delete(path.resolve(root));
}

/** Walk a project once and cache the result briefly so typing in a search box does not
 * trigger repeated filesystem scans. */
export async function scanApplicationContent(root: string, limit = 400): Promise<PlatformContent> {
  const key = path.resolve(root);
  const cached = scanCache.get(key);
  if (cached && Date.now() - cached.at < SCAN_CACHE_TTL_MS) return cached.content;
  const content = await scanApplicationContentUncached(root, limit);
  scanCache.set(key, { at: Date.now(), content });
  return content;
}

export async function discoverApplicationContent(
  root: string,
  options: ApplicationScanOptions | number = {},
): Promise<PlatformContent> {
  const resolved = typeof options === "number" ? { limit: options } : options;
  const base = await scanApplicationContent(root, resolved.limit ?? 400);
  return { files: filterApplicationContent(base.files, resolved.query ?? "", resolved.kinds) };
}

async function scanApplicationContentUncached(root: string, limit: number): Promise<PlatformContent> {
  const files: PlatformContent["files"] = [];
  const addedPaths = new Set<string>();
  const tsconfigPaths = await loadTsconfigPaths(root);

  const addFile = (child: string, text: string) => {
    if (addedPaths.has(child) || files.length >= limit) return;
    const analysis = analyzeApplicationModule(text);
    if (!analysis.default && !analysis.exports.length) return;
    const { kind, title, route } = classifyApplicationUnit(child);
    const readiness = applicationFileReadiness(child, analysis, text);
    addedPaths.add(child);
    files.push({
      path: child,
      default: analysis.default,
      exports: analysis.exports,
      kind,
      title,
      route,
      previewable: readiness.previewable,
      ...(readiness.issue ? { issue: readiness.issue } : {}),
    });
  };

  const checkAndAddResolved = async (candidatePath: string) => {
    if (addedPaths.has(candidatePath)) return;
    for (const ext of ["", ".tsx", ".jsx", ".ts", ".js", "/index.tsx", "/index.jsx"]) {
      const target = candidatePath + ext;
      const absolute = await resolveProjectTarget(root, target).catch(() => undefined);
      if (absolute) {
        const text = await readScoped(root, target, maxSourceBytes);
        if (text !== undefined) {
          addFile(target, text);
          break;
        }
      }
    }
  };

  const walk = async (relative: string) => {
    if (files.length >= limit) return;
    const absolute = await resolveProjectTarget(root, relative).catch(() => undefined);
    if (!absolute) return;
    const entries = await readdir(absolute, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (files.length >= limit) return;
      if (entry.name.startsWith(".") || protectedParts.has(entry.name)) continue;
      const child = `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        if (child === SCENE_RECIPE_DIRECTORY || child.startsWith(SCENE_RECIPE_DIRECTORY + "/")) continue;
        if (entry.name === "dist" || entry.name === "build" || entry.name === "node_modules") continue;
        await walk(child);
        continue;
      }
      if (!entry.isFile() || !isApplicationSourcePath(child)) continue;
      if (isIconOrPrimitive(child)) continue;
      const text = await readScoped(root, child, maxSourceBytes);
      if (text === undefined) continue;
      addFile(child, text);

      // Check imports inside page files
      if (child.includes("page.") || child.includes("index.")) {
        const importMatches = text.matchAll(/(?:import|from)\s*["']([^"']+)["']/g);
        for (const match of importMatches) {
          const spec = match[1];
          const resolved = resolveAliasSpecifier(spec, tsconfigPaths);
          if (resolved) {
            await checkAndAddResolved(resolved);
          }
        }
      }
    }
  };
  await walk("src");
  await walk("app");
  await walk("pages");
  await walk("components");
  return { files: files.sort((a, b) => a.path.localeCompare(b.path)) };
}

type SourceManifest = {
  name?: unknown;
  packageManager?: unknown;
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
};

const sourceLockfiles: Record<string, PlatformSource["packageManager"]> = {
  "package-lock.json": "npm", "npm-shrinkwrap.json": "npm", "pnpm-lock.yaml": "pnpm",
  "yarn.lock": "yarn", "bun.lock": "bun", "bun.lockb": "bun",
};

async function readManifestAt(root: string): Promise<SourceManifest | undefined> {
  const text = await readScoped(root, "package.json", 64_000).catch(() => undefined);
  if (text === undefined) return undefined;
  try { return JSON.parse(text) as SourceManifest; } catch { return undefined; }
}

function declaredManager(manifest: SourceManifest | undefined): PlatformSource["packageManager"] | undefined {
  const declared = typeof manifest?.packageManager === "string" ? manifest.packageManager.split(/[@/]/)[0] : "";
  return (["npm", "pnpm", "yarn", "bun"] as const).find(manager => manager === declared);
}

async function lockfileManager(root: string): Promise<PlatformSource["packageManager"] | undefined> {
  for (const [file, manager] of Object.entries(sourceLockfiles)) {
    if (await stat(path.join(root, file)).then(() => true, () => false)) return manager;
  }
  return undefined;
}

async function isDirectoryAt(root: string, relative: string): Promise<boolean> {
  return stat(path.join(root, relative)).then(info => info.isDirectory(), () => false);
}

/**
 * Read a candidate source folder without registering it. This powers the creation flow's
 * "check this path" step so users learn whether Seene can work with a folder before committing.
 */
export async function inspectSource(target: string): Promise<Omit<PlatformSource, "registered">> {
  const resolved = path.resolve(target.trim());
  const fallbackName = path.basename(resolved) || resolved;
  const base = {
    path: resolved,
    name: fallbackName,
    exists: false,
    isDirectory: false,
    react: false,
    hasPackageJson: false,
    connected: false,
    sceneDirectory: SCENE_RECIPE_DIRECTORY,
    sceneCount: 0,
  };
  const info = await stat(resolved).catch(() => undefined);
  if (!info) return { ...base, issue: "That folder does not exist. Check the path and try again." };
  if (!info.isDirectory()) return { ...base, exists: true, issue: "Select a folder, not a file." };

  const root = await realpath(resolved).catch(() => resolved);
  const manifest = await readManifestAt(root);
  const name = typeof manifest?.name === "string" && manifest.name.trim() ? manifest.name.trim() : path.basename(root) || root;
  const react = manifest ? typeof { ...manifest.dependencies, ...manifest.devDependencies }.react === "string" : false;

  const declaredManagerValue = declaredManager(manifest);
  let packageManager = declaredManagerValue;
  if (!packageManager) packageManager = await lockfileManager(root);

  let recorded: PlatformSource | undefined;
  const stateText = await readFile(path.join(root, ".seene", "project.json"), "utf8").catch(() => undefined);
  if (stateText !== undefined) {
    try {
      const state = ProjectStateSchema.parse(JSON.parse(stateText));
      recorded = {
        path: root, name, exists: true, isDirectory: true, react, hasPackageJson: true, connected: true,
        sceneDirectory: SCENE_RECIPE_DIRECTORY, sceneCount: 0, registered: false,
        packageManager: state.packageManager, adapter: state.adapter, entry: state.entry,
      } as PlatformSource;
    } catch { recorded = undefined; }
  }

  const catalog = await readSceneCatalog(root).catch(() => ({ scenes: [] }));
  const manager = recorded?.packageManager ?? packageManager;

  return {
    path: root,
    name,
    exists: true,
    isDirectory: true,
    react,
    hasPackageJson: manifest !== undefined,
    connected: recorded !== undefined,
    sceneDirectory: SCENE_RECIPE_DIRECTORY,
    sceneCount: catalog.scenes.length,
    ...(manager ? { packageManager: manager } : {}),
    ...(recorded?.adapter ? { adapter: recorded.adapter } : {}),
    ...(recorded?.entry ? { entry: recorded.entry } : {}),
    ...(!manifest
      ? { issue: "This folder has no package.json. Choose the folder that contains your React application." }
      : !react
      ? { issue: `${name} does not depend on react. Add react and react-dom to its package.json, then check again.` }
      : {}),
  };
}

const browseSkip = new Set([".git", "node_modules", "dist", "build", ".next", ".turbo", ".cache"]);

/**
 * List child folders of a directory so users can browse to a project instead of typing a path.
 * Only directory names and whether each looks like a React project are returned; no file
 * contents cross the boundary, and symlinked folders are skipped.
 */
export async function browseSourceDirectories(
  target: string | undefined,
  limit = 100,
): Promise<{ path: string; parent?: string; entries: PlatformDirectoryEntry[]; truncated: boolean; issue?: string }> {
  const resolved = path.resolve(target?.trim() || homedir());
  const info = await stat(resolved).catch(() => undefined);
  if (!info || !info.isDirectory()) {
    return { path: resolved, entries: [], truncated: false, issue: "Seene cannot open that folder. Check the path and permissions." };
  }
  const children = await readdir(resolved, { withFileTypes: true }).catch(() => undefined);
  if (!children) {
    return { path: resolved, entries: [], truncated: false, issue: "Seene cannot read that folder. Check permissions." };
  }
  const directories = children
    .filter(entry => entry.isDirectory() && !entry.name.startsWith(".") && !browseSkip.has(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const selected = directories.slice(0, limit);
  const entries = await Promise.all(selected.map(async entry => {
    const child = path.join(resolved, entry.name);
    const manifest = await readManifestAt(child);
    return {
      name: entry.name,
      path: child,
      hasPackageJson: manifest !== undefined,
      isReactProject: manifest ? typeof { ...manifest.dependencies, ...manifest.devDependencies }.react === "string" : false,
    } satisfies PlatformDirectoryEntry;
  }));
  const parentDirectory = path.dirname(resolved);
  return {
    path: resolved,
    ...(parentDirectory === resolved ? {} : { parent: parentDirectory }),
    entries,
    truncated: directories.length > selected.length,
  };
}

const discoverSkip = new Set([
  ...browseSkip,
  "Library", "Applications", "System", "Volumes", "Media", "Movies", "Music", "Pictures",
  "Public", "Templates", "venv", "__pycache__", "vendor", "Pods", "tmp", "temp",
]);

export type DiscoveredProject = Omit<PlatformDiscoveredProject, "registered">;

/**
 * Places on this machine that commonly hold checked-out applications. Scanning is explicit
 * (a user action) and shallow: each container plus its immediate children are considered.
 */
export function defaultProjectContainers(home = homedir()): string[] {
  const names = ["Projects", "projects", "dev", "code", "repos", "repositories", "workspace", "work", "src"];
  const parents = ["", "Desktop", "Documents", "Downloads", "Code"];
  const containers = [
    path.join(home, "Projects"), path.join(home, "dev"), path.join(home, "code"),
    path.join(home, "repos"), path.join(home, "workspace"),
  ];
  for (const parent of parents) {
    for (const name of names) {
      const candidate = path.join(home, parent, name);
      if (!containers.includes(candidate)) containers.push(candidate);
    }
  }
  return containers;
}

async function describeLocalProject(root: string): Promise<DiscoveredProject | undefined> {
  const manifest = await readManifestAt(root);
  if (!manifest) return undefined;
  const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
  const reactVersion = dependencies.react;
  if (typeof reactVersion !== "string") return undefined;

  const packageManager = declaredManager(manifest) ?? await lockfileManager(root);
  const isNext = typeof dependencies.next === "string";
  const framework: DiscoveredProject["framework"] = isNext ? "next" : typeof dependencies.vite === "string" ? "vite" : "react";
  const hasSeene = await readFile(path.join(root, ".seene", "project.json"), "utf8").then(() => true, () => false);
  const catalog = hasSeene ? await readSceneCatalog(root).catch(() => ({ scenes: [] })) : { scenes: [] };
  const modifiedMs = await stat(path.join(root, "package.json")).then(info => info.mtimeMs, () => undefined);

  return {
    path: root,
    name: typeof manifest.name === "string" && manifest.name.trim() ? manifest.name.trim() : path.basename(root) || root,
    framework,
    reactVersion: reactVersion.replace(/^[\^~>=<\s]+/, ""),
    ...(packageManager ? { packageManager } : {}),
    hasSeene,
    sceneCount: catalog.scenes.length,
    ...(modifiedMs !== undefined ? { modifiedMs } : {}),
  };
}

/**
 * Find React applications on this machine so a project can be registered with one click.
 * Only folder names and package.json facts leave the process; no source is uploaded.
 */
export async function discoverLocalProjects(
  containers: string[],
  limit = 40,
): Promise<{ roots: string[]; projects: DiscoveredProject[]; scanned: number; truncated: boolean }> {
  const roots: string[] = [];
  const candidates = new Set<string>();
  for (const container of containers) {
    const resolved = path.resolve(container);
    if (roots.includes(resolved)) continue;
    const info = await stat(resolved).catch(() => undefined);
    if (!info?.isDirectory()) continue;
    roots.push(resolved);
    candidates.add(resolved);
    const children = await readdir(resolved, { withFileTypes: true }).catch(() => []);
    for (const child of children) {
      if (!child.isDirectory() || child.name.startsWith(".") || discoverSkip.has(child.name)) continue;
      candidates.add(path.join(resolved, child.name));
    }
  }

  const projects: DiscoveredProject[] = [];
  let scanned = 0;
  let truncated = false;
  for (const candidate of candidates) {
    if (projects.length >= limit) { truncated = true; break; }
    scanned += 1;
    const described = await describeLocalProject(candidate).catch(() => undefined);
    if (described) projects.push(described);
  }
  projects.sort((a, b) => (b.modifiedMs ?? 0) - (a.modifiedMs ?? 0));
  return { roots, projects, scanned, truncated };
}

export { componentImportSpecifier };

export async function updateSceneRecipe(root: string, id: string, definition: Partial<PreviewDefinitionInput>): Promise<"updated" | "not-found"> {
  const directory = await resolveProjectTarget(root, SCENE_RECIPE_DIRECTORY);
  const recipePath = path.join(directory, `${id}.scene.json`);
  const exists = await lstat(recipePath).then(() => true, () => false);
  if (!exists) return "not-found";
  const before = await readFile(recipePath, "utf8");
  let parsed: SceneRecipe;
  try {
    parsed = JSON.parse(before) as SceneRecipe;
  } catch {
    return "not-found";
  }
  const merged = {
    ...parsed,
    definition: {
      ...parsed.definition,
      ...definition,
      ...(definition.backdrop === undefined ? { backdrop: undefined } : {}),
    },
  } as SceneRecipe;
  const validated = SceneRecipeSchema.safeParse(merged);
  if (!validated.success) return "not-found";
  const after = JSON.stringify(validated.data, null, 2) + "\n";
  if (after !== before) await writeFile(recipePath, after, { encoding: "utf8", flag: "w" });
  await syncWalkthroughScaffold(root, directory, id, validated.data.definition).catch(() => undefined);
  return "updated";
}

/**
 * Regenerate a Seene scaffold for a walkthrough so newly added component steps are rendered and
 * tagged with their node IDs. Only files Seene generated are rewritten; hand-authored files are
 * left untouched.
 */
async function syncWalkthroughScaffold(root: string, directory: string, id: string, definition: Partial<PreviewDefinitionInput>): Promise<void> {
  const walkthrough = definition.walkthrough;
  if (!walkthrough || definition.compositionType !== "walkthrough") return;
  let sourcePath: string | undefined;
  let source: string | undefined;
  for (const ext of ["tsx", "jsx"]) {
    const candidate = path.join(directory, `${id}.${ext}`);
    const text = await readFile(candidate, "utf8").catch(() => undefined);
    if (text !== undefined) {
      sourcePath = candidate;
      source = text;
      break;
    }
  }
  if (!sourcePath || !source || !source.startsWith("// @seene-scaffold-version")) return;
  const resolvedSections: Array<{ importSpecifier: string; export?: string; id?: string; title?: string }> = [];
  const seen = new Set<string>();
  for (const node of walkthrough.nodes) {
    const file = node.target?.file;
    if (!file || seen.has(file)) continue;
    seen.add(file);
    const absolute = path.resolve(root, file);
    const text = await readFile(absolute, "utf8").catch(() => undefined);
    if (text === undefined) continue;
    resolvedSections.push({
      importSpecifier: componentImportSpecifier(file),
      ...(node.target?.export ? { export: node.target.export } : {}),
      ...(node.target?.label ? { title: node.target.label } : {}),
    });
  }
  const next = sceneComponentSource({ id, compositionType: "walkthrough", sections: resolvedSections, walkthrough });
  if (next !== source) await writeFile(sourcePath, next, "utf8");
}
