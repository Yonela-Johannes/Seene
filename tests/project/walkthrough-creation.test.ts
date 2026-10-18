import { describe, expect, it, afterEach } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { componentImportSpecifier, createSceneRecipe, sceneComponentSource } from "../../src/core/platform";
import { discoverApplicationContent } from "../../src/vite/scene-files";

const roots: string[] = [];

async function createTempFolder() {
  const root = await mkdtemp(path.join(os.tmpdir(), "seene-walkthrough-test-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

describe("Website Walkthrough First-Class Scene Type Regression Tests", () => {
  it("discovers root-level layout components and generates alias imports", async () => {
    const root = await createTempFolder();
    const footerPath = path.join(root, "components/common/footer.tsx");
    await mkdir(path.dirname(footerPath), { recursive: true });
    await writeFile(footerPath, "export default function Footer() { return <footer>End</footer>; }");

    const content = await discoverApplicationContent(root);
    expect(content.files.map(file => file.path)).toContain("components/common/footer.tsx");
    expect(componentImportSpecifier("components/common/footer.tsx")).toBe("@/components/common/footer");
  });

  it("creates a Single Scene recipe and scaffold with single Surface host and configurable dimensions", () => {
    const recipe = createSceneRecipe({
      id: "single-demo",
      title: "Single Demo",
      compositionType: "scene",
      width: 1600,
      height: 1000,
    });

    expect(recipe.definition.compositionType).toBe("scene");
    expect(recipe.definition.width).toBe(1600);
    expect(recipe.definition.height).toBe(1000);

    const source = sceneComponentSource({
      id: "single-demo",
      compositionType: "scene",
      content: { importSpecifier: "../../components/Hero" },
    });

    expect(source).toContain('// @seene-scaffold-version 1');
    expect(source).toContain('import HostComponent from "../../components/Hero";');
    expect(source).toContain('<Surface id="host" style={{ width: 1400, height: 980 }}>');
    expect(source).not.toContain('WebsiteWalkthrough');
  });

  it("creates a Website Walkthrough recipe and scaffold with ordered section imports and viewport sizing", () => {
    const sections = [
      { id: "sec-1", title: "Header", file: "src/components/Header.tsx" },
      { id: "sec-2", title: "Hero", file: "src/components/Hero.tsx" },
      { id: "sec-3", title: "Footer", file: "src/components/Footer.tsx" },
    ];

    const recipe = createSceneRecipe({
      id: "walkthrough-demo",
      title: "Walkthrough Demo",
      compositionType: "walkthrough",
      sections,
    });

    expect(recipe.definition.compositionType).toBe("walkthrough");
    expect(recipe.definition.sizingMode).toBe("viewport");
    expect(recipe.definition.minHeight).toBe("100vh");
    expect(recipe.definition.sections?.length).toBe(3);
    expect(recipe.definition.walkthrough?.nodes.length).toBe(5);
    // The recipe carries a real compiled timeline: start + three 2.4s steps + end.
    expect(recipe.definition.motion?.durationMs).toBe(8600);
    expect(recipe.definition.motion?.speed).toBe(1);
    expect(recipe.definition.walkthroughSettings?.durationAuto).toBe(true);

    const sectionImports = [
      { id: "sec-1", title: "Header", importSpecifier: "@/components/Header" },
      { id: "sec-2", title: "Hero", importSpecifier: "@/components/Hero" },
      { id: "sec-3", title: "Footer", importSpecifier: "@/components/Footer" },
    ];

    const source = sceneComponentSource({
      id: "walkthrough-demo",
      compositionType: "walkthrough",
      sections: sectionImports,
    });

    expect(source).toContain('// @seene-scaffold-version 1');
    expect(source).toContain('import Header from "@/components/Header";');
    expect(source).toContain('import Hero from "@/components/Hero";');
    expect(source).toContain('import Footer from "@/components/Footer";');
    expect(source).toContain('<Surface id="host" style={{ width: "100%", height: "auto", minHeight: "100vh" }}>');
    expect(source).toContain('<Header />\n      <Hero />\n      <Footer />');
    expect(source).not.toContain('gap: "2rem"');
    expect(source).not.toContain("WalkthroughComponent");
  });

  it("preserves section ordering from top to bottom (Hero -> Features -> Footer)", () => {
    const orderedSections = [
      { id: "s1", title: "01 Hero", importSpecifier: "@/components/Hero" },
      { id: "s2", title: "02 Features", importSpecifier: "@/components/Features" },
      { id: "s3", title: "03 Footer", importSpecifier: "@/components/Footer" },
    ];

    const source = sceneComponentSource({
      id: "ordered-tour",
      compositionType: "walkthrough",
      sections: orderedSections,
    });

    const pos1 = source.indexOf('<Hero />');
    const pos2 = source.indexOf('<Features />');
    const pos3 = source.indexOf('<Footer />');

    expect(pos1).toBeGreaterThan(-1);
    expect(pos2).toBeGreaterThan(pos1);
    expect(pos3).toBeGreaterThan(pos2);
  });

  it("tags scaffold sections with walkthrough node IDs so targets resolve", () => {
    const sections = [
      { id: "sec-1", title: "Hero", file: "src/components/Hero.tsx" },
      { id: "sec-2", title: "Footer", file: "src/components/Footer.tsx" },
    ];
    const recipe = createSceneRecipe({ id: "tagged-tour", title: "Tagged Tour", compositionType: "walkthrough", sections });
    const walkthrough = recipe.definition.walkthrough!;
    const source = sceneComponentSource({
      id: "tagged-tour",
      compositionType: "walkthrough",
      sections: [
        { importSpecifier: "@/components/Hero", title: "Hero" },
        { importSpecifier: "@/components/Footer", title: "Footer" },
      ],
      walkthrough,
    });

    expect(source).toContain('import { WebsiteSection } from "@thatg33k/seene/preview";');
    const showIds = walkthrough.nodes.filter(node => node.type === "show").map(node => node.id);
    for (const id of showIds) expect(source).toContain(`<WebsiteSection id="${id}"`);
    // Every show step targets its own tagged section.
    for (const node of walkthrough.nodes.filter(node => node.type === "show")) {
      expect(node.target?.sectionId).toBe(node.id);
    }
  });
});
