import { describe, expect, it } from "vitest";
import { sceneComponentSource } from "../../src/core/platform";

describe("Scaffold source generation constraints", () => {
  it("asserts that generated scene Surface has no background, color, fontFamily, border or borderRadius style props", () => {
    // 1. With component selection
    const withComponent = sceneComponentSource({
      id: "hero",
      content: { importSpecifier: "../../components/Hero" },
    });

    // Extract the Surface tag style string
    const surfaceMatch1 = /<Surface\b[^>]*style=\{\{([^}]+)\}\}/.exec(withComponent);
    expect(surfaceMatch1).not.toBeNull();
    const surfaceStyle1 = surfaceMatch1![1];

    expect(surfaceStyle1).not.toContain("background");
    expect(surfaceStyle1).not.toContain("color");
    expect(surfaceStyle1).not.toContain("fontFamily");
    expect(surfaceStyle1).not.toContain("border");
    expect(surfaceStyle1).not.toContain("borderRadius");

    // 2. Without component selection (placeholder)
    const withoutComponent = sceneComponentSource({ id: "blank" });

    const surfaceMatch2 = /<Surface\b[^>]*style=\{\{([^}]+)\}\}/.exec(withoutComponent);
    expect(surfaceMatch2).not.toBeNull();
    const surfaceStyle2 = surfaceMatch2![1];

    expect(surfaceStyle2).not.toContain("background");
    expect(surfaceStyle2).not.toContain("color");
    expect(surfaceStyle2).not.toContain("fontFamily");
    expect(surfaceStyle2).not.toContain("border");
    expect(surfaceStyle2).not.toContain("borderRadius");
  });
});
