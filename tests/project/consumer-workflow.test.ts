import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer as createTcpServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";
import { executeProjectCommand } from "../../src/project/commands";
import { discoverRecipes } from "../../src/project/discovery";
import { seeneCreateScenePlugin } from "../../src/vite/seene-plugin";
import { ProjectResultSchema, type ProjectResult } from "../../src/core/project";

const roots: string[] = [];
const servers: ViteDevServer[] = [];

async function put(root: string, file: string, text: string) {
  await mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await writeFile(path.join(root, file), text);
}

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

const entry = `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode><App /></StrictMode>,
);
`;

const viteConfig = `import {defineConfig} from "vite"; import react from "@vitejs/plugin-react"; import {seeneCreateScenePlugin} from "@thatg33k/seene/vite"; export default defineConfig({plugins:[react(), seeneCreateScenePlugin()]});`;

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "seene-consumer-"));
  roots.push(root);
  await put(root, "package.json", JSON.stringify({
    name: "host",
    scripts: { dev: "vite" },
    dependencies: { react: "^19.2.0", "react-dom": "^19.2.0", "@thatg33k/seene": "0.1.0" },
    devDependencies: { vite: "^7.3.6" },
  }));
  await put(root, "package-lock.json", '{"lockfileVersion":3}');
  await put(root, "index.html", '<div id="root"></div><script type="module" src="/src/main.tsx"></script>');
  await put(root, "vite.config.ts", viteConfig);
  await put(root, "src/main.tsx", entry);
  await put(root, "src/App.tsx", "export default function App() { return <main>Real host dashboard</main>; }\n");
  await put(root, "node_modules/react/package.json", '{"name":"react","version":"19.2.0"}');
  await put(root, "node_modules/react-dom/package.json", '{"name":"react-dom","version":"19.2.0"}');
  await put(root, "node_modules/@thatg33k/seene/package.json", JSON.stringify({
    name: "@thatg33k/seene",
    version: "0.1.0",
    exports: { "./preview": { import: "./preview.js" }, "./vite": { import: "./vite.js" } },
  }));
  await put(root, "node_modules/@thatg33k/seene/preview.js", "export const ProjectPreview = () => null;\n");
  return root;
}

function success(result: ProjectResult) {
  expect(ProjectResultSchema.safeParse(result).success).toBe(true);
  expect(result, JSON.stringify(result)).toMatchObject({ success: true });
  if (!result.success) throw new Error(JSON.stringify(result));
  return result.data;
}

async function start(root: string) {
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
  return `http://127.0.0.1:${address.port}`;
}

async function create(origin: string, id: string, title: string) {
  return fetch(`${origin}/__seene/create-scene`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id,
      recipe: {
        version: 1,
        id,
        title,
        description: "Authored in Seene Studio",
        definition: {
          scene: {
            version: 3,
            camera: { perspective: 1800, rotateX: 4, rotateY: -7 },
            focus: { distance: 1800, fStop: 8, focalLength: 50, maxBlur: 6 },
            nodes: [{ id: "seene-application" }],
          },
          motion: { durationMs: 4000, tracks: [] },
        },
      },
    }),
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => server.close()));
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

describe("initialized consumer workflow", () => {
  it("initializes without rewriting host configuration and wires scene discovery to the real app", async () => {
    const root = await fixture();
    const result = success(await executeProjectCommand("init-project", {}, { root }));
    expect(result.project?.projectId).toMatch(/^[0-9a-f-]{36}$/);

    const adapter = await readFile(path.join(root, "src/seene/ProjectPreview.tsx"), "utf8");
    expect(adapter).toContain("import { ProjectPreview } from \"@thatg33k/seene/preview\"");
    expect(adapter).toContain("import.meta.glob(\"/src/seene/scenes/*.{scene.json,tsx,jsx}\")");
    expect(adapter).toContain("sceneModules={sceneModules}");

    const adaptedEntry = await readFile(path.join(root, "src/main.tsx"), "utf8");
    expect(adaptedEntry).toContain("<StrictMode><App /></StrictMode>");
    expect(adaptedEntry).toMatch(/<SeeneProjectPreview projectId="[^"]+" enabled=\{import\.meta\.env\.DEV\}>/);
    expect(adaptedEntry).toContain('import { SeeneProjectPreview } from "./seene/ProjectPreview"');

    expect(await readFile(path.join(root, "vite.config.ts"), "utf8")).toBe(viteConfig);
    expect(JSON.parse(await readFile(path.join(root, ".seene/project.json"), "utf8"))).toMatchObject({
      version: 1,
      projectId: result.project?.projectId,
      entry: "src/main.tsx",
    });

    const pkg = JSON.parse(await readFile(fileURLToPath(new URL("../../package.json", import.meta.url)), "utf8"));
    expect(pkg.exports["./vite"]).toEqual({ types: "./dist/library/types/vite/seene-plugin.d.ts", import: "./dist/library/vite.js" });
    expect(pkg.bin.seene).toBe("./dist/cli/seene.js");
    expect(viteConfig).toContain('from "@thatg33k/seene/vite"');
  });

  it("creates, discovers, reopens and survives a dev-server restart with one broken file diagnostic", async () => {
    const root = await fixture();
    success(await executeProjectCommand("init-project", {}, { root }));

    let origin = await start(root);
    expect((await create(origin, "revenue-tour", "Revenue tour")).status).toBe(200);
    expect((await create(origin, "revenue-detail", "Revenue detail")).status).toBe(200);

    const first = await discoverRecipes(root, "revenue-tour");
    expect(first.issues).toEqual([]);
    expect(first.scenes.map(scene => scene.id)).toEqual(["revenue-detail", "revenue-tour"]);
    expect(first.selected?.id).toBe("revenue-tour");
    expect(first.selected?.source).toBe("src/seene/scenes/revenue-tour.scene.json");
    expect(first.selected?.binding).toBe("src/seene/scenes/revenue-tour.tsx");

    const stopped = servers.pop();
    await stopped!.close();
    origin = await start(root);

    const second = await discoverRecipes(root, "revenue-tour");
    expect(second.issues).toEqual([]);
    expect(second.scenes.map(scene => scene.id)).toEqual(["revenue-detail", "revenue-tour"]);
    expect(second.selected?.id).toBe("revenue-tour");

    await put(root, "src/seene/scenes/faulty.scene.json", "{ not valid json");
    await put(root, "src/seene/scenes/faulty.tsx", "export default () => null;");
    const third = await discoverRecipes(root, "revenue-detail");
    expect(third.scenes.map(scene => scene.id)).toEqual(["revenue-detail", "revenue-tour"]);
    expect(third.selected?.id).toBe("revenue-detail");
    expect(third.issues).toEqual([
      { path: "src/seene/scenes/faulty.scene.json", message: "Invalid recipe JSON. Correct its syntax and reload the scene list." },
    ]);

    expect((await create(origin, "revenue-tour", "Revenue tour")).status).toBe(409);
    expect((await readdir(path.join(root, "src/seene/scenes"))).sort()).toEqual([
      "faulty.scene.json",
      "faulty.tsx",
      "revenue-detail.scene.json",
      "revenue-detail.tsx",
      "revenue-tour.scene.json",
      "revenue-tour.tsx",
    ]);
  }, 30_000);

  it("persists the complete scene definition sent by the Studio inspector", async () => {
    const root = await fixture();
    success(await executeProjectCommand("init-project", {}, { root }));
    const origin = await start(root);
    expect((await create(origin, "inspector-save", "Inspector save")).status).toBe(200);

    const definition = {
      width: 1600,
      height: 900,
      scene: {
        version: 3,
        camera: { perspective: 1500, x: 12, y: 4, z: 20, rotateX: 8, rotateY: -12, rotateZ: 2 },
        focus: { distance: 1550, fStop: 2.8, focalLength: 85, maxBlur: 10 },
        nodes: [{ id: "seene-application", transform: { x: 24, y: -8, z: 40 } }],
      },
      motion: { durationMs: 6000, speed: 1, tracks: [] },
      backdrop: "#10151d",
    };
    const response = await fetch(`${origin}/__seene/create-scene`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "inspector-save", recipe: { definition } }),
    });

    expect(response.status).toBe(200);
    const saved = JSON.parse(await readFile(path.join(root, "src/seene/scenes/inspector-save.scene.json"), "utf8"));
    expect(saved.definition).toMatchObject(definition);
  });
});
