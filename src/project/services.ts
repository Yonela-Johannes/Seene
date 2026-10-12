import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {lstat, realpath, readFile, writeFile, mkdir, rm, rename, link} from 'node:fs/promises';
import path from 'node:path';
import {fault} from './errors';

export function computeContentHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export async function canonicalRoot(root: string): Promise<string> {
  return realpath(path.resolve(root));
}

export function packageManagerUserAgent(): string | undefined {
  return process.env.npm_config_user_agent;
}

export function newProjectId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "00000000-0000-4000-8000-000000000000";
}

export async function isRegularFile(root: string, target: string): Promise<boolean> {
  const absolute = await scopedPath(root, target);
  const stat = await lstat(absolute).catch(() => undefined);
  return stat ? stat.isFile() && !stat.isSymbolicLink() : false;
}

const ignoredScanDirectories = new Set([
  ".agents", ".cache", ".claude", ".codex", ".cursor", ".git", ".idea", ".kilo",
  ".next", ".opencode", ".seene", ".turbo", ".vscode", ".zed", ".vite",
  "build", "coverage", "dist", "node_modules", "out", "vendor",
]);

export async function scanDirectory(root: string, dir: string, maxEntries = 1000): Promise<string[]> {
  const absolute = await scopedPath(root, dir);
  const results: string[] = [];
  async function walk(current: string) {
    if (results.length >= maxEntries) return;
    const entries = await import("node:fs/promises").then(fs => fs.readdir(current, { withFileTypes: true })).catch(error => {
      if (error?.code === "ENOENT") return [];
      throw error;
    });
    for (const entry of entries) {
      if (results.length >= maxEntries) break;
      const resPath = path.join(current, entry.name);
      const relPath = path.relative(root, resPath).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        if (ignoredScanDirectories.has(entry.name)) continue;
        await walk(resPath);
      } else if (entry.isFile()) {
        results.push(relPath);
      }
    }
  }
  await walk(absolute);
  return results;
}

export async function installPackage(root: string, packageSource: string, packageManager: "npm" | "pnpm" | "yarn" | "bun"): Promise<void> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const exec = promisify(execFile);
  const command = packageManager === "npm" ? "install" : "add";
  // A failed auto-install is the most common first-run failure; surface its real cause
  // instead of letting it collapse into a generic project error.
  try {
    await exec(packageManager, [command, packageSource], { cwd: root });
  } catch (error) {
    const detail = error instanceof Error ? error.message.replace(/\s+/g, " ").trim() : "";
    throw fault("install-failed",
      `${packageManager} could not install ${packageSource}: ${detail || "the install command failed"}. ` +
      `Install it manually with \`${packageManager} ${command} ${packageSource}\` and re-run seene init.`);
  }
}

export async function scopedPath(root: string, target: string): Promise<string> {
  const relative = target.replace(/^[/\\]+/, "");
  const absolute = path.resolve(root, relative);
  const normalizedRoot = path.resolve(root) + path.sep;
  const normalizedAbsolute = path.resolve(absolute);
  if (normalizedAbsolute !== path.resolve(root) && !normalizedAbsolute.startsWith(normalizedRoot))
    throw fault("denied-path", "Entry traversal/protected target " + target, target);
  const parts = path.relative(path.resolve(root), normalizedAbsolute).split(path.sep).filter(Boolean);
  if (parts.includes(".git") || parts.includes("node_modules"))
    throw fault("denied-path", "Entry traversal/protected target " + target, target);
  let current = path.resolve(root);
  for (const part of parts) {
    current = path.join(current, part);
    const entry = await lstat(current).catch(error => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    if (entry?.isSymbolicLink()) throw fault("denied-path", "Denies symlink targets " + target, target);
  }
  return absolute;
}
export function relativeTarget(target: string): string {
  if (path.isAbsolute(target) || /^(?:\0|[a-zA-Z]:|[/\\])/.test(target))
    throw fault("denied-path", "Expected a project-relative path.", target);
  const normalized = path.normalize(target).replace(/\\/g, "/");
  if (normalized.startsWith("../") || normalized === ".."
    || normalized.split("/").some(part => part === ".git" || part === "node_modules"))
    throw fault("denied-path", "Expected a project-relative path.", target);
  return normalized;
}
export async function readText(root: string, target: string, maxBytes?: number): Promise<string | undefined> {
  const absolute = await scopedPath(root, target);
  const text = await readFile(absolute, "utf8").catch(error => {
    if (error.code === "ENOENT") return undefined;
    throw error;
  });
  return text !== undefined && (maxBytes === undefined || text.length <= maxBytes) ? text : undefined;
}
export async function readRecipe(root: string, target: string, maxBytes?: number): Promise<string | undefined> {
  return readText(root, target, maxBytes);
}
export async function writeText(root: string, target: string, text: string): Promise<void> {
  const absolute = await scopedPath(root, target);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, text, "utf8");
}
export async function removeText(root: string, target: string, expected: string): Promise<void> {
  const absolute = await scopedPath(root, target);
  const current = await readFile(absolute, "utf8").catch(() => undefined);
  if (current === expected) await rm(absolute, { force: true });
}
export async function atomicWrite(root: string, target: string, text: string, expectedBefore?: string): Promise<void> {
  const absolute = await scopedPath(root, target);
  const current = await readText(root, target).catch(() => undefined);
  if (expectedBefore !== undefined && current !== expectedBefore)
    throw fault("conflict", "Target file was modified since inspection.", target);
  const temp = absolute + "." + Math.random().toString(36).slice(2) + ".tmp";
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(temp, text, "utf8");
  if (expectedBefore === undefined) {
    try {
      await link(temp, absolute);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "EEXIST")
        throw fault("conflict", "Target file was created during setup.", target);
      throw error;
    } finally {
      await rm(temp, { force: true });
    }
    return;
  }
  const currentBeforeReplace = await readText(root, target).catch(() => undefined);
  if (currentBeforeReplace !== expectedBefore) {
    await rm(temp, { force: true });
    throw fault("conflict", "Target file was modified during setup.", target);
  }
  await rename(temp, absolute);
}
export async function fetchText(url: string, timeout = 10_000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    return await response.text();
  } catch (error) {
    throw fault("network-error", `Failed to reach development server: ${(error as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}
export async function openBrowser(root: string, url: string): Promise<void> {
  const { spawn } = await import("node:child_process");
  const platform = process.platform;
  const command = platform === "darwin" ? "open" : platform === "win32" ? "cmd.exe" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", url] : [url];
  const child = spawn(command, args, { stdio: "ignore", detached: true });
  child.unref();
}
export async function localPackageSource(root: string, source: string): Promise<string> {
  const filename = path.isAbsolute(source) ? source : await scopedPath(root, source.replace(/^\.\//, ""));
  const stat = await lstat(filename).catch(error => {
    if (error.code === "ENOENT") throw fault("package-unavailable", "Local Seene tarball was not found. Correct --package to an existing .tgz file, or re-run seene init to install the published package instead.", source);
    throw error;
  });
  if (!stat.isFile() || stat.isSymbolicLink()) throw fault("denied-path", "Package source must be a regular local tarball.");
  return realpath(filename);
}

export function pause(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

export async function readDependency(root:string,name:string,target="package.json"):Promise<string|undefined> {
  if (!["react","react-dom","@thatg33k/seene"].includes(name)) throw fault("invalid-input","Unknown runtime dependency.");
  relativeTarget(target);
  const candidates=createRequire(path.join(root,"package.json")).resolve.paths(name)??[];
  for(const modules of candidates) {
    let directory:string;
    try { directory=await realpath(path.join(modules,name)); }
    catch(error) { if((error as NodeJS.ErrnoException).code==="ENOENT")continue;throw error; }
    return readText(directory,target);
  }
  return undefined;
}

export async function writeSceneSourcePair(root: string, id: string, recipe: unknown, componentSource: string): Promise<"created" | "exists"> {
  const recipeTarget = `src/seene/scenes/${id}.scene.json`;
  const bindingTarget = `src/seene/scenes/${id}.tsx`;

  if (await readText(root, recipeTarget) !== undefined || await readText(root, bindingTarget) !== undefined) {
    return "exists";
  }

  await writeText(root, bindingTarget, componentSource);
  await writeText(root, recipeTarget, typeof recipe === "string" ? recipe : JSON.stringify(recipe, null, 2) + "\n");

  return "created";
}
