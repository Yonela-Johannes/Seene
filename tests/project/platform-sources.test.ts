import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { createServer as createTcpServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { seenePlatformPlugin } from "../../src/vite/platform-plugin";

const servers: ViteDevServer[] = [];
const roots: string[] = [];
let previousHome: string | undefined;

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

/** Writes a realistic React project: a default-export component, a named-only component,
 * an aliased import and a Next-style route file. */
async function writeProject(root: string) {
  await mkdir(path.join(root, "src/components"), { recursive: true });
  await mkdir(path.join(root, "app/dashboard"), { recursive: true });
  await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "demo-app", dependencies: { react: "^19.0.0", "react-dom": "^19.0.0" } }));
  await writeFile(path.join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["src/*"] } } }));
  await writeFile(path.join(root, "src/components/Hero.tsx"), "export default function Hero() { return <h1>Hero</h1>; }\n");
  await writeFile(path.join(root, "src/components/Panel.tsx"), "export function Panel() { return <div />; }\nexport function PanelHeader() { return <div />; }\n");
  await writeFile(path.join(root, "src/components/Icons.tsx"), "export function IconPlus() { return <svg />; }\n");
  await writeFile(path.join(root, "app/dashboard/page.tsx"), 'import Hero from "@/components/Hero";\nexport default function Page() { return <Hero />; }\n');
}

async function start() {
  const host = await mkdtemp(path.join(os.tmpdir(), "seene-platform-host-"));
  const project = await mkdtemp(path.join(os.tmpdir(), "seene-platform-app-"));
  const home = await mkdtemp(path.join(os.tmpdir(), "seene-platform-home-"));
  roots.push(host, project, home);
  await writeProject(project);
  process.env.SEENE_HOME = home;
  const server = await createServer({
    configFile: false,
    root: host,
    plugins: [seenePlatformPlugin()],
    server: { host: "127.0.0.1", port: await freePort(), strictPort: true },
    logLevel: "silent",
  });
  servers.push(server);
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") throw new Error("Vite did not expose a local address.");
  return { host, project, origin: `http://127.0.0.1:${address.port}` };
}

beforeEach(() => { previousHome = process.env.SEENE_HOME; });

afterEach(async () => {
  if (previousHome === undefined) delete process.env.SEENE_HOME; else process.env.SEENE_HOME = previousHome;
  await Promise.all(servers.splice(0).map(server => server.close()));
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

const json = async <T>(response: Response): Promise<T> => (await response.json()) as T;

/** Node's fetch forbids overriding Host, so a raw request proves the loopback guard. */
function rawStatus(origin: string, pathname: string, host: string): Promise<number> {
  const url = new URL(pathname, origin);
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method: "GET", headers: { Host: host } },
      response => { response.resume(); response.on("end", () => resolve(response.statusCode ?? 0)); },
    );
    request.on("error", reject);
    request.end();
  });
}

describe("platform source discovery endpoints", () => {
  it("reports readiness for every discovered file and filters by query and kind", async () => {
    const { project, origin } = await start();
    const registered = await fetch(`${origin}/__seene/platform/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: project }),
    });
    expect(registered.status).toBe(200);

    const all = await json<{ content: { files: Array<{ path: string; kind?: string; previewable?: boolean; issue?: string }> } }>(
      await fetch(`${origin}/__seene/platform/projects/content?path=${encodeURIComponent(project)}`),
    );
    const hero = all.content.files.find(file => file.path.endsWith("Hero.tsx"));
    const route = all.content.files.find(file => file.path.endsWith("page.tsx"));
    expect(hero?.previewable).toBe(true);
    expect(route?.previewable).toBe(false);
    expect(route?.issue).toMatch(/Route files/);

    const named = await json<{ content: { files: Array<{ path: string; default: boolean }> } }>(
      await fetch(`${origin}/__seene/platform/projects/content?path=${encodeURIComponent(project)}&q=panel`),
    );
    expect(named.content.files.map(file => file.path)).toEqual(["src/components/Panel.tsx"]);
    expect(named.content.files[0].default).toBe(false);

    const pages = await json<{ content: { files: Array<{ kind?: string }> } }>(
      await fetch(`${origin}/__seene/platform/projects/content?path=${encodeURIComponent(project)}&kind=page`),
    );
    expect(pages.content.files.length).toBeGreaterThan(0);
    expect(pages.content.files.every(file => file.kind === "page")).toBe(true);
  });

  it("inspects a folder before it is registered and explains what is missing", async () => {
    const { project, host, origin } = await start();
    const before = await json<{ source: { react: boolean; registered: boolean; name: string; connected: boolean } }>(
      await fetch(`${origin}/__seene/platform/projects/sources/inspect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: project }),
      }),
    );
    expect(before.source).toMatchObject({ react: true, registered: false, name: "demo-app", connected: false });

    const missing = await json<{ source: { exists: boolean; issue?: string } }>(
      await fetch(`${origin}/__seene/platform/projects/sources/inspect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: path.join(host, "does-not-exist") }),
      }),
    );
    expect(missing.source.exists).toBe(false);
    expect(missing.source.issue).toMatch(/does not exist/);
  });

  it("lists child folders for browsing and refuses non-loopback callers", async () => {
    const { project, origin } = await start();
    const listing = await json<{ path: string; parent?: string; entries: Array<{ name: string; path: string }>; truncated: boolean }>(
      await fetch(`${origin}/__seene/platform/projects/sources/browse?path=${encodeURIComponent(project)}`),
    );
    expect(listing.path).toBe(project);
    expect(listing.entries.map(entry => entry.name)).toEqual(["app", "src"]);
    expect(listing.truncated).toBe(false);

    expect(await rawStatus(origin, "/__seene/platform/projects/sources/browse", "192.168.1.5:4173")).toBe(400);
    expect(await rawStatus(origin, "/__seene/platform/projects/sources/browse", "127.0.0.1:4173")).toBe(200);
  });

  it("sees scene creation through the cached scan", async () => {
    const { project, origin } = await start();
    await fetch(`${origin}/__seene/platform/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: project }),
    });
    // Warm the scan cache, then confirm the first scan already reflects a file added afterwards
    // only once the cache is invalidated by a write.
    await fetch(`${origin}/__seene/platform/projects/content?path=${encodeURIComponent(project)}`);
    await writeFile(path.join(project, "src/components/AddedLater.tsx"), "export default function AddedLater() { return null; }\n");
    const cached = await json<{ content: { files: Array<{ path: string }> } }>(
      await fetch(`${origin}/__seene/platform/projects/content?path=${encodeURIComponent(project)}`),
    );
    expect(cached.content.files.some(file => file.path.endsWith("AddedLater.tsx"))).toBe(false);

    // Creating a scene invalidates the scan so new files are picked up immediately.
    await fetch(`${origin}/__seene/platform/projects/scenes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: project, id: "added-later", title: "Added Later", compositionType: "scene",
        sections: [{ file: "src/components/AddedLater.tsx" }],
      }),
    });
    const refreshed = await json<{ content: { files: Array<{ path: string }> } }>(
      await fetch(`${origin}/__seene/platform/projects/content?path=${encodeURIComponent(project)}`),
    );
    expect(refreshed.content.files.some(file => file.path.endsWith("AddedLater.tsx"))).toBe(true);
  });

  it("finds React applications in a folder, skips the rest and marks registered ones", async () => {
    const { origin } = await start();
    const scanRoot = await mkdtemp(path.join(os.tmpdir(), "seene-scan-"));
    roots.push(scanRoot);
    const write = async (name: string, pkg: Record<string, unknown>) => {
      await mkdir(path.join(scanRoot, name), { recursive: true });
      await writeFile(path.join(scanRoot, name, "package.json"), JSON.stringify(pkg));
    };
    await write("vite-app", { name: "vite-app", dependencies: { react: "^18.2.0", vite: "^5.0.0" } });
    await write("next-app", { name: "next-app", dependencies: { react: "^19.0.0", next: "^15.0.0" } });
    await write("server-lib", { name: "server-lib", dependencies: { express: "^4.0.0" } });
    await write(".hidden-app", { name: "hidden-app", dependencies: { react: "^19.0.0" } });

    type Scan = { roots: string[]; projects: Array<{ path: string; name: string; framework: string; reactVersion?: string; registered: boolean; hasSeene: boolean; sceneCount: number }>; scanned: number; truncated: boolean };
    const scan = await json<Scan>(await fetch(`${origin}/__seene/platform/projects/sources/discover?root=${encodeURIComponent(scanRoot)}`));
    expect(scan.roots).toEqual([path.resolve(scanRoot)]);
    expect(scan.projects.map(project => project.name).sort()).toEqual(["next-app", "vite-app"]);
    expect(scan.truncated).toBe(false);
    const vite = scan.projects.find(project => project.name === "vite-app");
    expect(vite).toMatchObject({ framework: "vite", reactVersion: "18.2.0", registered: false, hasSeene: false, sceneCount: 0 });
    expect(scan.projects.find(project => project.name === "next-app")?.framework).toBe("next");

    await fetch(`${origin}/__seene/platform/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: path.join(scanRoot, "vite-app") }),
    });
    const again = await json<Scan>(await fetch(`${origin}/__seene/platform/projects/sources/discover?root=${encodeURIComponent(scanRoot)}`));
    expect(again.projects.find(project => project.name === "vite-app")?.registered).toBe(true);
    expect(again.projects[0].name).toBe("vite-app");

    expect(await rawStatus(origin, "/__seene/platform/projects/sources/discover", "192.168.1.5:4173")).toBe(400);
  });
});
