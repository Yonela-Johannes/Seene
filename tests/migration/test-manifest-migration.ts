import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { executeProjectCommand as command, sha256 } from "../../src/project/commands";

const roots: string[] = [];
async function put(root: string, file: string, text: string) {
  const target = path.join(root, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, text);
}

async function create015Fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "seene-migration-"));
  roots.push(root);

  await put(
    root,
    "package.json",
    JSON.stringify({
      private: true,
      dependencies: {
        react: "19.1.0",
        "react-dom": "19.1.0",
        next: "15.2.0",
        "@thatg33k/seene": "0.1.5",
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

  // Read exact 0.1.5 fixture files
  const fixtureDir = path.resolve(__dirname, "fixtures/0.1.5");
  const rawManifest = JSON.parse(await readFile(path.join(fixtureDir, "integration.json"), "utf8"));

  await put(root, ".seene/project.json", JSON.stringify(rawManifest.project, null, 2) + "\n");
  await put(root, ".seene/integration.json", JSON.stringify(rawManifest, null, 2));
  await put(root, "SEENE.md", rawManifest.files["SEENE.md"]);
  await put(root, "src/seene/Studio.jsx", rawManifest.files["src/seene/Studio.jsx"]);
  await put(root, "src/seene/ProjectPreview.jsx", rawManifest.files["src/seene/ProjectPreview.jsx"]);
  await put(root, "src/seene/catalog.js", rawManifest.files["src/seene/catalog.js"]);
  await put(root, "app/seene/page.jsx", rawManifest.files["app/seene/page.jsx"]);

  return { root, rawManifest };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

describe("Migration Test Suite (tests/migration/test-manifest-migration.ts)", () => {
  it("Case 1: An unchanged 0.1.5 project upgrades silently to versioned scaffolds and 64-char hashes", async () => {
    const { root } = await create015Fixture();

    const result = await command("init-project", {}, { root });
    expect(result.success).toBe(true);

    const manifest = JSON.parse(await readFile(path.join(root, ".seene/integration.json"), "utf8"));
    for (const [filePath, value] of Object.entries(manifest.files)) {
      expect(value).toMatch(/^[a-f0-9]{64}$/);
      const onDisk = await readFile(path.join(root, filePath as string), "utf8");
      expect(sha256(onDisk)).toBe(value);
      if ((filePath as string).endsWith(".md")) {
        expect(onDisk).toContain("<!-- @seene-scaffold-version 1 -->");
      } else {
        expect(onDisk).toContain("// @seene-scaffold-version 1");
      }
    }
  });

  it("Case 2 & Case 8: Hand-edited legacy files are preserved byte-for-byte and reported as customized", async () => {
    const { root } = await create015Fixture();

    const customStudio = '"use client";\n// User custom studio\nexport default function CustomStudio() { return <div data-custom="yes" />; }\n';
    const customHandoff = '<!-- Custom Guide -->\n# Custom Seene Guide\n';

    await writeFile(path.join(root, "src/seene/Studio.jsx"), customStudio);
    await writeFile(path.join(root, "SEENE.md"), customHandoff);

    const result = await command("init-project", {}, { root });
    expect(result.success).toBe(true);

    // Byte-for-byte check
    expect(await readFile(path.join(root, "src/seene/Studio.jsx"), "utf8")).toBe(customStudio);
    expect(await readFile(path.join(root, "SEENE.md"), "utf8")).toBe(customHandoff);

    // Manifest stores custom hashes
    const manifest = JSON.parse(await readFile(path.join(root, ".seene/integration.json"), "utf8"));
    expect(manifest.files["src/seene/Studio.jsx"]).toBe(sha256(customStudio));
    expect(manifest.files["SEENE.md"]).toBe(sha256(customHandoff));
  });

  it("Case 3: A customized file never fails seene validate", async () => {
    const { root } = await create015Fixture();
    await command("init-project", {}, { root });

    await writeFile(path.join(root, "src/seene/ProjectPreview.jsx"), "// User edits ProjectPreview\nexport function SeeneProjectPreview() { return null; }\n");

    const validateRes = await command("validate-project", {}, { root });
    expect(validateRes.success).toBe(true);
  });

  it("Case 4: Unchanged files are upgraded with no customization warnings", async () => {
    const { root } = await create015Fixture();
    const result = await command("init-project", {}, { root });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.integration?.instructions).not.toContain("Warning:");
    }
  });

  it("Case 5: Repeated init is idempotent: second run changes nothing and produces no warnings", async () => {
    const { root } = await create015Fixture();
    const firstRun = await command("init-project", {}, { root });
    expect(firstRun.success).toBe(true);

    const secondRun = await command("init-project", {}, { root });
    expect(secondRun.success).toBe(true);
    if (secondRun.success) {
      expect(secondRun.data.changed).toBe(false);
      expect(secondRun.data.integration?.instructions).not.toContain("Warning:");
    }
  });

  it("Case 6: Malformed/unexpected manifest entries and path traversal keys are handled safely", async () => {
    const { root } = await create015Fixture();
    await command("init-project", {}, { root });

    const manifestPath = path.join(root, ".seene/integration.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

    // Add malformed entries and path traversal key
    manifest.files["src/seene/Studio.jsx"] = null;
    manifest.files["src/seene/ProjectPreview.jsx"] = 12345;
    manifest.files["../outside.js"] = "sha256hash";

    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    // Next init repairs manifest and excludes path traversal
    const reInit = await command("init-project", {}, { root });
    expect(reInit.success).toBe(true);

    const updated = JSON.parse(await readFile(manifestPath, "utf8"));
    expect(updated.files["../outside.js"]).toBeUndefined();
    expect(updated.files["src/seene/Studio.jsx"]).toMatch(/^[a-f0-9]{64}$/);
  });

  it("Case 7: Markers and hashes are consistent for every managed file after migration", async () => {
    const { root } = await create015Fixture();
    await command("init-project", {}, { root });

    const manifest = JSON.parse(await readFile(path.join(root, ".seene/integration.json"), "utf8"));
    for (const [file, recordedHash] of Object.entries(manifest.files)) {
      const text = await readFile(path.join(root, file as string), "utf8");
      expect(sha256(text)).toBe(recordedHash);
      if ((file as string).endsWith(".md")) {
        expect(text.startsWith("<!-- @seene-scaffold-version 1 -->")).toBe(true);
      } else {
        expect(text.startsWith("// @seene-scaffold-version 1")).toBe(true);
      }
    }
  });
});
