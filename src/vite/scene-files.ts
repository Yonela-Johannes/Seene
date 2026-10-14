import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { SCENE_RECIPE_DIRECTORY, type SceneCatalog, type SceneRecipe, SceneRecipeSchema } from "../core/recipes";
import { RESOURCES } from "../core/resources";
import { analyzeApplicationModule, classifyApplicationUnit, componentImportSpecifier, isApplicationSourcePath, isIconOrPrimitive, sceneComponentName, type PlatformContent } from "../core/platform";
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
  const directory = await resolveProjectTarget(root, SCENE_RECIPE_DIRECTORY);
  const recipePath = path.join(directory, `${id}.scene.json`);
  const removed = await lstat(recipePath).then(() => true, () => false);
  await rm(recipePath, { force: true });
  await rm(path.join(directory, `${id}.tsx`), { force: true });
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

export async function discoverApplicationContent(root: string, limit = 400): Promise<PlatformContent> {
  const files: PlatformContent["files"] = [];
  const addedPaths = new Set<string>();
  const tsconfigPaths = await loadTsconfigPaths(root);

  const addFile = (child: string, text: string) => {
    if (addedPaths.has(child) || files.length >= limit) return;
    const analysis = analyzeApplicationModule(text);
    if (!analysis.default && !analysis.exports.length) return;
    const { kind, title, route } = classifyApplicationUnit(child);
    addedPaths.add(child);
    files.push({
      path: child,
      default: analysis.default,
      exports: analysis.exports,
      kind,
      title,
      route,
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
  return { files: files.sort((a, b) => a.path.localeCompare(b.path)) };
}

export { componentImportSpecifier };

export async function updateSceneRecipe(root: string, id: string, definition: { backdrop?: string | undefined }): Promise<"updated" | "not-found"> {
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
  if (after === before) return "updated";
  await writeFile(recipePath, after, { encoding: "utf8", flag: "w" });
  return "updated";
}
