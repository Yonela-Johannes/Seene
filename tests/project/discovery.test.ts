import { describe, expect, it, afterEach } from "vitest";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defaultProjectContainers, discoverLocalProjects } from "../../src/vite/scene-files";

const roots: string[] = [];

async function makeDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
  roots.push(dir);
  return dir;
}

/** Writes a candidate project folder with the package.json facts discovery reads. */
async function writeApp(container: string, name: string, pkg: Record<string, unknown>, options: { seene?: boolean } = {}): Promise<string> {
  const dir = path.join(container, name);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ name, ...pkg }));
  if (options.seene) {
    await mkdir(path.join(dir, ".seene"), { recursive: true });
    await writeFile(path.join(dir, ".seene", "project.json"), JSON.stringify({ version: 1 }));
  }
  return dir;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

describe("local project discovery", () => {
  it("offers a stable, de-duplicated set of common project containers", () => {
    const containers = defaultProjectContainers("/home/tester");
    expect(containers[0]).toBe(path.join("/home/tester", "Projects"));
    expect(containers).toContain(path.join("/home/tester", "dev"));
    expect(containers).toContain(path.join("/home/tester", "Desktop", "Projects"));
    expect(containers).toContain(path.join("/home/tester", "Documents", "code"));
    // No duplicates, even though several parent/name pairs resolve to the same folder.
    expect(new Set(containers).size).toBe(containers.length);
  });

  it("finds React applications, skips everything else, and reads framework facts", async () => {
    const container = await makeDir("seene-discovery-");
    await writeApp(container, "vite-app", { version: "1.0.0", dependencies: { react: "^18.2.0", vite: "^5.0.0" }, packageManager: "pnpm@9.0.0" }, { seene: true });
    await writeApp(container, "next-app", { version: "1.0.0", dependencies: { react: "^19.0.0", next: "^15.0.0" } });
    await writeApp(container, "plain-react", { version: "1.0.0", dependencies: { react: "19.1.0", "react-dom": "19.1.0" } });
    await writeApp(container, "express-lib", { version: "1.0.0", dependencies: { express: "^4.0.0" } });
    await writeApp(container, ".hidden-app", { version: "1.0.0", dependencies: { react: "^19.0.0" } });

    const scan = await discoverLocalProjects([container]);
    expect(scan.roots).toEqual([path.resolve(container)]);
    expect(scan.truncated).toBe(false);
    expect(scan.projects.map(project => project.name).sort()).toEqual(["next-app", "plain-react", "vite-app"]);

    const vite = scan.projects.find(project => project.name === "vite-app");
    expect(vite).toMatchObject({ framework: "vite", reactVersion: "18.2.0", packageManager: "pnpm", hasSeene: true, sceneCount: 0 });
    expect(scan.projects.find(project => project.name === "next-app")?.framework).toBe("next");
    expect(scan.projects.find(project => project.name === "plain-react")?.framework).toBe("react");
  });

  it("sorts the newest projects first and reports truncation when the limit is hit", async () => {
    const container = await makeDir("seene-discovery-limit-");
    const oldest = await writeApp(container, "oldest", { dependencies: { react: "^19.0.0" } });
    const middle = await writeApp(container, "middle", { dependencies: { react: "^19.0.0" } });
    const newest = await writeApp(container, "newest", { dependencies: { react: "^19.0.0" } });
    const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000);
    await utimes(path.join(oldest, "package.json"), at(10), at(10));
    await utimes(path.join(middle, "package.json"), at(5), at(5));
    await utimes(path.join(newest, "package.json"), at(1), at(1));

    const full = await discoverLocalProjects([container]);
    expect(full.projects.map(project => project.name)).toEqual(["newest", "middle", "oldest"]);

    const capped = await discoverLocalProjects([container], 2);
    expect(capped.projects).toHaveLength(2);
    expect(capped.truncated).toBe(true);
    expect(capped.projects.map(project => project.name)).toEqual(["newest", "middle"]);
  });

  it("ignores containers that do not exist", async () => {
    const container = await makeDir("seene-discovery-missing-");
    const scan = await discoverLocalProjects([path.join(container, "not-here")]);
    expect(scan).toMatchObject({ roots: [], projects: [], scanned: 0, truncated: false });
  });
});
