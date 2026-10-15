import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { executeProjectCommand as command, sha256 } from "../../src/project/commands";
import { validateHostComponent, sceneComponentSource, componentImportSpecifier } from "../../src/core/platform";

const roots: string[] = [];
async function put(root: string, file: string, text: string) {
  const target = path.join(root, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, text);
}

async function createNextHost() {
  const root = await mkdtemp(path.join(os.tmpdir(), "seene-phase1b-"));
  roots.push(root);
  await put(
    root,
    "package.json",
    JSON.stringify({
      dependencies: {
        react: "19.1.0",
        "react-dom": "19.1.0",
        next: "15.2.0",
        "@thatg33k/seene": "0.1.0",
      },
      scripts: { dev: "next dev" },
    }),
  );
  for (const name of ["react", "react-dom"]) {
    await put(root, "node_modules/" + name + "/package.json", JSON.stringify({ name, version: "19.1.0" }));
  }
  await put(
    root,
    "node_modules/@thatg33k/seene/package.json",
    JSON.stringify({
      name: "@thatg33k/seene",
      exports: { "./preview": { import: "./preview.js" }, "./next": { import: "./next.js" } },
    }),
  );
  await put(root, "node_modules/@thatg33k/seene/preview.js", "export {}");
  await put(root, "node_modules/@thatg33k/seene/next.js", "export {}");
  await put(root, "app/layout.tsx", "export default function Layout({children}: {children: React.ReactNode}) { return <html><body>{children}</body></html> }");
  await put(root, "src/components/Header.tsx", '"use client";\nimport React from "react";\nexport default function Header() { return <header>App Header</header>; }\n');
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

describe("Phase 1b: Versioned files, upgrade rules and manifest migration", () => {
  it("migrates an old full-text manifest to SHA-256 hashes and auto-upgrades unchanged scaffolds", async () => {
    const root = await createNextHost();
    const initRes = await command("init-project", {}, { root });
    expect(initRes.success).toBe(true);
    if (!initRes.success) return;

    const manifestPath = path.join(root, ".seene/integration.json");
    const studioPath = path.join(root, "src/seene/Studio.jsx");
    const oldStudioText = "// Old studio scaffold without version marker\nexport default function Studio() { return null; }";

    // Write old format manifest storing full file text
    const oldManifest = {
      project: initRes.data.project,
      files: {
        "src/seene/catalog.js": await readFile(path.join(root, "src/seene/catalog.js"), "utf8"),
        "src/seene/ProjectPreview.jsx": await readFile(path.join(root, "src/seene/ProjectPreview.jsx"), "utf8"),
        "src/seene/Studio.jsx": oldStudioText,
        "app/seene/page.jsx": await readFile(path.join(root, "app/seene/page.jsx"), "utf8"),
        "app/api/seene/create-scene/route.js": await readFile(path.join(root, "app/api/seene/create-scene/route.js"), "utf8"),
        "SEENE.md": await readFile(path.join(root, "SEENE.md"), "utf8"),
      },
    };
    await writeFile(manifestPath, JSON.stringify(oldManifest, null, 2));
    await writeFile(studioPath, oldStudioText);

    // Re-run init
    const reInit = await command("init-project", {}, { root });
    expect(reInit.success).toBe(true);

    // Assert manifest now stores 64-char SHA-256 hashes
    const updatedManifest = JSON.parse(await readFile(manifestPath, "utf8"));
    for (const [file, value] of Object.entries(updatedManifest.files)) {
      expect(value).toMatch(/^[a-f0-9]{64}$/);
    }

    // Studio.jsx was auto-upgraded to new scaffold with version marker
    const newStudioText = await readFile(studioPath, "utf8");
    expect(newStudioText).toContain("// @seene-scaffold-version 1");
    expect(sha256(newStudioText)).toBe(updatedManifest.files["src/seene/Studio.jsx"]);

    // Validation passes
    const validateRes = await command("validate-project", {}, { root });
    expect(validateRes.success).toBe(true);
  });

  it("preserves user-edited customized files and never fails validate", async () => {
    const root = await createNextHost();
    expect((await command("init-project", {}, { root })).success).toBe(true);

    const studioPath = path.join(root, "src/seene/Studio.jsx");
    const customStudio = '"use client";\nexport default function CustomStudio() { return <div data-custom="true" />; }';
    await writeFile(studioPath, customStudio);

    // Re-run init
    const syncRes = await command("init-project", {}, { root });
    expect(syncRes.success).toBe(true);

    // Custom studio file is left untouched
    expect(await readFile(studioPath, "utf8")).toBe(customStudio);

    // Validation passes
    const validateRes = await command("validate-project", {}, { root });
    expect(validateRes.success).toBe(true);
  });

  it("handles seene init --host <path> with validation, security traversal checks and warnings", async () => {
    const root = await createNextHost();

    // 1. Invalid path
    const invalidRes = await command("init-project", { hostPath: "src/components/Missing.tsx" }, { root });
    expect(invalidRes.success).toBe(false);
    if (!invalidRes.success) {
      expect(invalidRes.issues[0].message).toContain('Host component path "src/components/Missing.tsx" does not exist');
    }

    // 2. Path traversal check
    const traversalRes = await command("init-project", { hostPath: "../outside.tsx" }, { root });
    expect(traversalRes.success).toBe(false);

    // 3. Valid host component
    const validRes = await command("init-project", { hostPath: "src/components/Header.tsx" }, { root });
    expect(validRes.success).toBe(true);

    const sceneFile = path.join(root, "src/seene/scenes/header.tsx");
    const sceneSource = await readFile(sceneFile, "utf8");
    expect(sceneSource).toContain("// @seene-scaffold-version 1");
    expect(sceneSource).toContain('"use client";');
    expect(sceneSource).toContain('import HostComponent from "@/components/Header";');
    expect(sceneSource).toContain('<Surface id="host" style={{ width: 1400, height: 980 }}>');

    // 4. Route file warning in a fresh host
    const root2 = await createNextHost();
    await put(root2, "app/page.tsx", 'export default function Page() { return <div>Home</div>; }');
    const routeRes = await command("init-project", { hostPath: "app/page.tsx" }, { root: root2 });
    expect(routeRes.success).toBe(true);
    if (routeRes.success) {
      expect(routeRes.data.integration?.instructions).toContain("Warning: app/page.tsx is a route file");
    }
  });

  it("validates host components correctly across export forms", () => {
    // Function default export
    expect(validateHostComponent("src/Header.tsx", "export default function Header() {}")).toEqual({ valid: true, warning: undefined });

    // Class default export
    expect(validateHostComponent("src/Header.tsx", "export default class Header {}")).toEqual({ valid: true, warning: undefined });

    // Arrow function default export
    expect(validateHostComponent("src/Header.tsx", "const Header = () => {}; export default Header;")).toEqual({ valid: true, warning: undefined });

    // Missing default export
    expect(() => validateHostComponent("src/Header.tsx", "export function Header() {}")).toThrow('Host component "src/Header.tsx" has no default export.');

    // Route file warning
    expect(validateHostComponent("app/page.tsx", "export default function Page() {}")).toEqual({
      valid: true,
      warning: "Warning: app/page.tsx is a route file, which cannot be mounted in the client tree.",
    });

    // Async server component warning
    expect(validateHostComponent("src/Header.tsx", "export default async function Header() {}")).toEqual({
      valid: true,
      warning: "Warning: src/Header.tsx is an async Server Component, which cannot be mounted in the client tree.",
    });
  });

  it("calculates componentImportSpecifier correctly across all host file locations", () => {
    expect(componentImportSpecifier("src/components/Header.tsx")).toBe("@/components/Header");
    expect(componentImportSpecifier("components/Header.tsx")).toBe("@/components/Header");
    expect(componentImportSpecifier("app/page.tsx")).toBe("@/app/page");
    expect(componentImportSpecifier("pages/index.tsx")).toBe("@/pages/index");
    expect(componentImportSpecifier("src/seene/scenes/sub/Widget.tsx")).toBe("@/seene/scenes/sub/Widget");
    expect(componentImportSpecifier("src\\components\\Header.js")).toBe("@/components/Header");
  });
});
