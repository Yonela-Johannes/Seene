import { describe, expect, it, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createSceneRecipe, sceneComponentSource } from "../../src/core/platform";

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

    const sectionImports = [
      { id: "sec-1", title: "Header", importSpecifier: "../../components/Header" },
      { id: "sec-2", title: "Hero", importSpecifier: "../../components/Hero" },
      { id: "sec-3", title: "Footer", importSpecifier: "../../components/Footer" },
    ];

    const source = sceneComponentSource({
      id: "walkthrough-demo",
      compositionType: "walkthrough",
      sections: sectionImports,
    });

    expect(source).toContain('// @seene-scaffold-version 1');
    expect(source).toContain('import { WebsiteWalkthrough } from "@thatg33k/seene/preview";');
    expect(source).toContain('import SectionComponent1 from "../../components/Header";');
    expect(source).toContain('import SectionComponent2 from "../../components/Hero";');
    expect(source).toContain('import SectionComponent3 from "../../components/Footer";');
    expect(source).toContain('sections={[');
    expect(source).toContain('{ id: "sec-1", label: "Header", children: <SectionComponent1 /> }');
    expect(source).toContain('{ id: "sec-2", label: "Hero", children: <SectionComponent2 /> }');
    expect(source).toContain('{ id: "sec-3", label: "Footer", children: <SectionComponent3 /> }');
  });

  it("preserves section ordering from top to bottom (Hero -> Features -> Footer)", () => {
    const orderedSections = [
      { id: "s1", title: "01 Hero", importSpecifier: "../../components/Hero" },
      { id: "s2", title: "02 Features", importSpecifier: "../../components/Features" },
      { id: "s3", title: "03 Footer", importSpecifier: "../../components/Footer" },
    ];

    const source = sceneComponentSource({
      id: "ordered-tour",
      compositionType: "walkthrough",
      sections: orderedSections,
    });

    const pos1 = source.indexOf('SectionComponent1');
    const pos2 = source.indexOf('SectionComponent2');
    const pos3 = source.indexOf('SectionComponent3');

    expect(pos1).toBeGreaterThan(-1);
    expect(pos2).toBeGreaterThan(pos1);
    expect(pos3).toBeGreaterThan(pos2);
  });
});
