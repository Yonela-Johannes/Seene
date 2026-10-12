import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { executeRecipeCommand } from "../../src/project/recipes";
import { discoverRecipes } from "../../src/project/discovery";
import * as commands from "../../src/project/commands";
import * as services from "../../src/project/services";
import { loadSceneRecipes } from "../../src/core/recipes";
import { extractSurfaceIds } from "../../src/project/surfaces";
import { runCli } from "../../src/cli";

const roots: string[] = [];
const directory = "src/seene/scenes";
const recipe = (id = "demo") => ({ version: 1, id, title: id, definition: { scene: { nodes: [{ id: "panel" }], focus: { distance: 1800 } }, motion: { durationMs: 200, tracks: [] } } });
async function root() {
  const value = await mkdtemp(path.join(tmpdir(), "seene-recipes-"));
  roots.push(value);
  return value;
}
async function put(root: string, target: string, text: string) {
  await mkdir(path.dirname(path.join(root, target)), { recursive: true });
  await writeFile(path.join(root, target), text);
}
async function add(root: string, id = "demo", document: unknown = recipe(id)) {
  await put(root, `${directory}/${id}.scene.json`, JSON.stringify(document));
  await put(root, `${directory}/${id}.tsx`, 'import { Surface } from "@thatg33k/seene"; throw new Error("must never execute component source"); export default () => <Surface id="panel">Panel</Surface>;');
}
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map(value => rm(value, { recursive: true, force: true })));
});
describe("scoped recipe commands", () => {
  it("returns honest empty discovery for a missing directory", async () => {
    expect(await executeRecipeCommand("list-scenes", {}, { root: await root() })).toEqual({ success: true, data: { scenes: [], issues: [], warnings: [] } });
  });
  it("keeps project worktrees and generated/cache directories out of broad discovery scans", async () => {
    const value = await root();
    await add(value, "valid");
    const ignored = [".kilo/worktrees/beautiful-makemake", ".agents/worktrees/task", ".claude", ".codex", ".cursor", ".git", ".idea", ".next", ".turbo", ".vscode", ".vite", ".cache", "build", "coverage", "dist", "node_modules", "out", "vendor"];
    for (const directory of ignored)
      await put(value, `${directory}/src/seene/scenes/test-one.scene.json`, JSON.stringify(recipe("test-one")));
    await put(value, `${directory}/.kilo/worktrees/beautiful-makemake/src/seene/scenes/test-one.scene.json`, JSON.stringify(recipe("test-one")));

    const scanned = await services.scanDirectory(value, ".", 1000);
    expect(scanned).toContain(`${directory}/valid.scene.json`);
    for (const directory of ignored)
      expect(scanned.some(file => file.startsWith(`${directory}/`))).toBe(false);

    const catalog = await discoverRecipes(value);
    expect(catalog.scenes.map(scene => scene.id)).toEqual(["valid"]);
    expect(catalog.issues).toEqual([]);
  });
  it("loads exactly the browser core catalog without executing components", async () => {
    const value = await root();
    await add(value);
    const expected = loadSceneRecipes({ sources: [{ path: `${directory}/demo.scene.json`, document: recipe() }], bindingPaths: [`${directory}/demo.tsx`], sceneId: "demo" });
    expect(await executeRecipeCommand("load-scene", { sceneId: "demo" }, { root: value })).toEqual({ success: true, data: expected });
  });
  it("recovers independently from bad JSON, unknown version, missing binding and oversized source", async () => {
    const value = await root();
    await add(value);
    await add(value, "future", { ...recipe("future"), version: 9 });
    await put(value, `${directory}/broken.scene.json`, "{");
    await put(value, `${directory}/unbound.scene.json`, JSON.stringify(recipe("unbound")));
    await put(value, `${directory}/huge.scene.json`, " ".repeat(256_001));
    const result = await executeRecipeCommand("list-scenes", {}, { root: value });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected recoverable catalog");
    expect(result.data.scenes.map(scene => scene.id)).toEqual(["demo"]);
    expect(result.data.issues).toHaveLength(4);
    expect(await executeRecipeCommand("load-scene", { sceneId: "future" }, { root: value })).toMatchObject({ success: false });
    await add(value, "future");
    expect(await executeRecipeCommand("load-scene", { sceneId: "future" }, { root: value })).toMatchObject({ success: true, data: { selected: { id: "future" } } });
  });
  it("excludes duplicate IDs in distinct files and refuses invalid selection before any read", async () => {
    const value = await root();
    await add(value);
    await add(value, "second", recipe());
    expect(await executeRecipeCommand("list-scenes", {}, { root: value })).toMatchObject({ success: true, data: { scenes: [] } });
    const scan = vi.spyOn(services, "scanDirectory");
    expect(await executeRecipeCommand("load-scene", { sceneId: "../demo" }, { root: value })).toMatchObject({ success: false });
    expect(scan).not.toHaveBeenCalled();
  });
  it.each(["demo.scene.json", "demo.tsx"])("does not follow symlinked %s while preserving another scene", async target => {
    const value = await root(), outside = await root();
    await add(value); await add(value, "valid"); await add(outside);
    await rm(path.join(value, directory, target));
    await symlink(path.join(outside, directory, target), path.join(value, directory, target));
    const result = await executeRecipeCommand("list-scenes", {}, { root: value });
    expect(result).toMatchObject({ success: true, data: { scenes: [{ id: "valid" }] } });
    if (!result.success) throw new Error("Expected recipe discovery to succeed");
    expect(result.data.scenes.map(scene => scene.id)).not.toContain("demo");
    if (target === "demo.tsx")
      expect(result.data.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: `${directory}/demo.tsx`, message: expect.stringContaining("needs matching component") }),
      ]));
  });
  it("denies a symlinked recipe directory and traversal through scoped services", async () => {
    const value = await root(), outside = await root();
    await add(outside);
    await mkdir(path.join(value, "src/seene"), { recursive: true });
    await symlink(path.join(outside, directory), path.join(value, directory));
    expect(await executeRecipeCommand("list-scenes", {}, { root: value })).toMatchObject({ success: false });
    await expect(services.scanDirectory(value, "../outside", 10)).rejects.toMatchObject({ code: "denied-path" });
  });
  it("caps discovery and rejects directory-shaped component bindings", async () => {
    const value = await root();
    await add(value);
    await rm(path.join(value, directory, "demo.tsx"));
    await mkdir(path.join(value, directory, "demo.tsx"));
    expect(await executeRecipeCommand("load-scene", { sceneId: "demo" }, { root: value })).toMatchObject({ success: false });
    await Promise.all(Array.from({ length: 260 }, (_, i) => put(value, `${directory}/filler-${i}`, "")));
    const entries = await services.scanDirectory(value, directory, 256);
    expect(entries).toHaveLength(256);
    const result = await executeRecipeCommand("list-scenes", {}, { root: value });
    expect(result.success).toBe(true);
  });
  it("rejects malformed scope and unknown fields before effects", async () => {
    const canonical = vi.spyOn(services, "canonicalRoot");
    expect(await executeRecipeCommand("list-scenes", { directory: "../outside" }, { root: "/unused" })).toMatchObject({ success: false });
    expect(canonical).not.toHaveBeenCalled();
    expect(await executeRecipeCommand("list-scenes", {}, { root: "relative" })).toMatchObject({ success: false });
  });
  it("opens only the selected final URL after canonical preview verification", async () => {
    const value = await root(); await add(value);
    const execute = vi.spyOn(commands, "executeProjectCommand").mockResolvedValue({ success: true, data: { url: "http://127.0.0.1:5173/?seene-preview=1" } });
    const browser = vi.spyOn(services, "openBrowser").mockResolvedValue();
    const result = await executeRecipeCommand("open-scene", { sceneId: "demo", url: "http://127.0.0.1:5173" }, { root: value });
    expect(execute).toHaveBeenCalledWith("open-preview", { url: "http://127.0.0.1:5173", launch: false }, { root: await services.canonicalRoot(value) });
    expect(result).toMatchObject({ success: true, data: { selected: { id: "demo" }, url: "http://127.0.0.1:5173/?seene-preview=1&seene-scene=demo" } });
    expect(browser).toHaveBeenCalledExactlyOnceWith(await services.canonicalRoot(value), "http://127.0.0.1:5173/?seene-preview=1&seene-scene=demo");
    browser.mockClear();
    await executeRecipeCommand("open-scene", { sceneId: "demo", url: "http://127.0.0.1:5173", launch: false }, { root: value });
    expect(browser).not.toHaveBeenCalled();
    execute.mockResolvedValue({ success: false, issues: [{ code: "missing-dev-server", message: "Run npm run dev." }] });
    expect(await executeRecipeCommand("open-scene", { sceneId: "demo", url: "http://127.0.0.1:5173" }, { root: value })).toMatchObject({ success: false, issues: [{ message: "Run npm run dev." }] });
    expect(browser).not.toHaveBeenCalled();
  });
  it("does not verify/open a server for unavailable selection or non-loopback URL", async () => {
    const value = await root(); await add(value);
    const execute = vi.spyOn(commands, "executeProjectCommand");
    for (const input of [{ sceneId: "missing", url: "http://localhost:5173" }, { sceneId: "demo", url: "https://example.com" }])
      expect(await executeRecipeCommand("open-scene", input, { root: value })).toMatchObject({ success: false });
    expect(execute).not.toHaveBeenCalled();
  });
  it("extracts Surface IDs statically without failing on dynamic IDs, spread attributes, or imported components", () => {
    expect(extractSurfaceIds('<Surface id="alpha"><Surface id="beta">UI</Surface></Surface>', "test.tsx")).toEqual({
      literalIds: new Set(["alpha", "beta"]),
      unverifiableReason: undefined,
    });
    expect(extractSurfaceIds('import { Surface as S } from "@thatg33k/seene"; export default function Scene(){ return <S id="alpha">UI</S>; }', "test.tsx")).toEqual({
      literalIds: new Set(["alpha"]),
      unverifiableReason: undefined,
    });
    expect(extractSurfaceIds('import type { SurfaceProps } from "@thatg33k/seene"; import "./styles.css"; import { clsx } from "clsx"; import { Surface } from "@thatg33k/seene"; export default function Scene(){ return <Surface id="alpha">UI</Surface>; }', "test.tsx")).toEqual({
      literalIds: new Set(["alpha"]),
      unverifiableReason: undefined,
    });
    expect(extractSurfaceIds('<Surface id={dynamicId}>UI</Surface>', "test.tsx")).toEqual({
      literalIds: new Set(),
      unverifiableReason: "Uses dynamic computed ID on Surface.",
    });
    expect(extractSurfaceIds('<Seene.Surface id="alpha">UI</Seene.Surface>', "test.tsx")).toEqual({
      literalIds: new Set(),
      unverifiableReason: "Uses member expression Surface (Seene.Surface).",
    });
    expect(extractSurfaceIds('<Surface id="alpha" {...props}>UI</Surface>', "test.tsx")).toEqual({
      literalIds: new Set(),
      unverifiableReason: "Uses spread attributes on Surface.",
    });
    expect(extractSurfaceIds('import Hero from "./Hero"; export default function Scene(){ return <Surface id="alpha"><Hero /></Surface>; }', "test.tsx")).toEqual({
      literalIds: new Set(["alpha"]),
      unverifiableReason: "Renders locally imported component (<Hero />).",
    });
  });
  it("emits catalog warnings for missing surface nodes without failing sync-project or validate", async () => {
    const value = await root();
    await put(value, `${directory}/demo.scene.json`, JSON.stringify(recipe("demo")));
    await put(value, `${directory}/demo.tsx`, 'import { Surface } from "@thatg33k/seene"; export default function Scene(){ return <Surface id="other">Other</Surface>; }');
    const catalog = await discoverRecipes(value);
    expect(catalog.issues).toEqual([]);
    expect(catalog.warnings.length).toBeGreaterThan(0);
    expect(catalog.warnings[0].message).toContain("missing from component");
    const sync = await executeRecipeCommand("list-scenes", {}, { root: value });
    expect(sync.success).toBe(true);
  });
});
describe("scene CLI adapter", () => {
  it("lists and loads actual scoped source using the same catalog", async () => {
    const value = await root(); await add(value);
    const context = { root: value };
    expect((await runCli(["scenes"], context)).stdout).toContain("demo\tdemo");
    const result = await runCli(["load", "--scene", "demo", "--json"], context);
    expect(JSON.parse(result.stdout)).toEqual(await executeRecipeCommand("load-scene", { sceneId: "demo" }, context));
    expect((await runCli(["load", "--scene", "missing"], context)).code).toBe(1);
  });
  it("routes open through the fifth executor without changing existing injection positions", async () => {
    const execute = vi.fn(), exporter = vi.fn();
    const recipes = vi.fn().mockResolvedValue({ success: true, data: { scenes: [], issues: [], url: "http://localhost:6211/?seene-preview=1&seene-scene=demo" } });
    const result = await runCli(["open", "--scene", "demo", "--project", "/host", "--no-open"], { root: "/default", port: "6211" }, execute, exporter, recipes);
    expect(recipes).toHaveBeenCalledWith("open-scene", { sceneId: "demo", url: "http://127.0.0.1:6211", launch: false }, { root: "/host" });
    expect(result.stdout).toContain("seene-scene=demo");
    expect(execute).not.toHaveBeenCalled(); expect(exporter).not.toHaveBeenCalled();
  });
  it.each([["scenes", "--url", "http://localhost"], ["scenes", "--scene", "demo"], ["validate", "--scene", "demo"], ["load", "--scene"], ["open", "--scene", "demo", "--scene", "other"]])("rejects invalid scene flags %j", async (...args) => {
    const recipes = vi.fn();
    expect((await runCli(args, { root: "/unused" }, vi.fn(), vi.fn(), recipes)).code).toBe(2);
    expect(recipes).not.toHaveBeenCalled();
  });
});
