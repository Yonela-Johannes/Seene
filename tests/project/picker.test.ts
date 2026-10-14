import { describe, expect, it, afterEach } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { discoverApplicationContent, resolveAliasSpecifier } from "../../src/vite/scene-files";
import { sceneComponentSource, validateHostComponent } from "../../src/core/platform";

const roots: string[] = [];

async function createTestRepo() {
  const root = await mkdtemp(path.join(os.tmpdir(), "seene-picker-test-"));
  roots.push(root);

  // Write tsconfig.json with path aliases
  await mkdir(path.join(root, "src/components"), { recursive: true });
  await mkdir(path.join(root, "app"), { recursive: true });

  await writeFile(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "@/*": ["src/*"],
        },
      },
    }),
  );

  // Write a component at src/components/Header.tsx
  await writeFile(
    path.join(root, "src/components/Header.tsx"),
    'export default function Header() { return <header>Header</header>; }',
  );

  // Write a component at src/components/Footer.tsx
  await writeFile(
    path.join(root, "src/components/Footer.tsx"),
    'export default function Footer() { return <footer>Footer</footer>; }',
  );

  // Write app/page.tsx importing Header via tsconfig alias @/components/Header
  await writeFile(
    path.join(root, "app/page.tsx"),
    'import Header from "@/components/Header";\nexport default function Page() { return <main><Header /></main>; }',
  );

  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

describe("Item 3: Component Picker & Alias Resolution Tests", () => {
  it("resolves tsconfig path aliases and discovers components imported in app/page.tsx", async () => {
    // 1. Alias specifier helper test
    const paths = { "@/*": ["src/*"] };
    expect(resolveAliasSpecifier("@/components/Header", paths)).toBe("src/components/Header");

    // 2. Full discovery test
    const root = await createTestRepo();
    const result = await discoverApplicationContent(root);

    const pathsDiscovered = result.files.map(f => f.path);
    expect(pathsDiscovered).toContain("app/page.tsx");
    expect(pathsDiscovered).toContain("src/components/Header.tsx");
    expect(pathsDiscovered).toContain("src/components/Footer.tsx");
  });

  it("supports a whole-page/canvas option (no content selection)", () => {
    const emptySource = sceneComponentSource({ id: "full-app" });
    expect(emptySource).toContain('// @seene-scaffold-version 1');
    expect(emptySource).toContain('<Surface id="host" style={{ width: 1400, height: 980 }}>');
    expect(emptySource).toContain('Edit src/seene/scenes/full-app.tsx to add your component.');
    expect(emptySource).not.toContain('import HostComponent');
  });

  it("writes imports in the exact order selected by the user", () => {
    const multiContent = [
      { importSpecifier: "../../components/Header", export: "Header" },
      { importSpecifier: "../../components/Footer", export: "Footer" },
    ];

    const generated = sceneComponentSource({ id: "multi", content: multiContent });

    const lines = generated.split("\n");
    const headerIndex = lines.findIndex(l => l.includes("../../components/Header"));
    const footerIndex = lines.findIndex(l => l.includes("../../components/Footer"));

    expect(headerIndex).toBeGreaterThan(-1);
    expect(footerIndex).toBeGreaterThan(-1);
    expect(headerIndex).toBeLessThan(footerIndex);

    expect(generated).toContain("import { Header as HostComponent1 } from \"../../components/Header\";");
    expect(generated).toContain("import { Footer as HostComponent2 } from \"../../components/Footer\";");
    expect(generated).toContain("<HostComponent1 />");
    expect(generated).toContain("<HostComponent2 />");
  });

  it("warns on async Server Components and route files", () => {
    // Server component warning
    const asyncServerComp = 'export default async function ServerComp() { return <div>Async</div>; }';
    const serverVal = validateHostComponent("src/components/ServerComp.tsx", asyncServerComp);
    expect(serverVal.valid).toBe(true);
    expect(serverVal.warning).toContain("Warning: src/components/ServerComp.tsx is an async Server Component");

    // Route file warning
    const routeFile = 'export default function Page() { return <div>Page</div>; }';
    const routeVal = validateHostComponent("app/page.tsx", routeFile);
    expect(routeVal.valid).toBe(true);
    expect(routeVal.warning).toContain("Warning: app/page.tsx is a route file");
  });
});
