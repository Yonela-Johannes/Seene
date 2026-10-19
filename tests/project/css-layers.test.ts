import { describe, expect, it } from "vitest";
import { namespaceCssLayers } from "../../scripts/css-layers";

const TAILWIND_V3_DIRECTIVES = ["@layer base", "@layer components", "@layer utilities"];

describe("namespaceCssLayers", () => {
  it("namespaces a block layer without changing its body or order", () => {
    expect(namespaceCssLayers("@layer base{h1{color:red}}@layer utilities{.m{margin:0}}"))
      .toBe("@layer seene-base{h1{color:red}}@layer seene-utilities{.m{margin:0}}");
  });

  it("namespaces every name in an order statement", () => {
    expect(namespaceCssLayers("@layer theme, base, components, utilities;:root{--x:1}"))
      .toBe("@layer seene-theme, seene-base, seene-components, seene-utilities;:root{--x:1}");
  });

  it("leaves anonymous layers, other at-rules and plain CSS alone", () => {
    const css = "@layer{:root{--x:1}}@media(min-width:1px){.a{color:red}}@supports (x:y){.b{color:blue}}";
    expect(namespaceCssLayers(css)).toBe(css);
  });

  it("ignores the @layer text inside strings, urls and comments", () => {
    const css = '.a{content:"@layer base"}/* @layer utilities */ .b{background:url(data:image/svg+xml,@layer base)}';
    expect(namespaceCssLayers(css)).toBe(css);
  });

  it("does not double-prefix names that are already namespaced", () => {
    const css = "@layer seene-base{h1{color:red}}";
    expect(namespaceCssLayers(css)).toBe(css);
  });

  it("preserves whitespace around comma-separated layer names", () => {
    expect(namespaceCssLayers("@layer  theme ,  base ;")).toBe("@layer  seene-theme ,  seene-base ;");
  });

  it("strips Tailwind v3 reserved directives from real Tailwind v4 output", () => {
    const tailwindV4 = '@layer properties{@supports (not (color:rgb(from red r g b))){*{--tw-translate-x:0}}}' +
      "@layer theme{:root{--color-red:red}}" +
      "@layer base{*,:before,:after{box-sizing:border-box}}" +
      "@layer components{.btn{display:inline-flex}}" +
      "@layer utilities{.flex{display:flex}}";
    const result = namespaceCssLayers(tailwindV4);
    for (const directive of TAILWIND_V3_DIRECTIVES) expect(result).not.toContain(directive);
    expect(result).toContain("@layer seene-base{");
    expect(result).toContain("@layer seene-components{");
    expect(result).toContain("@layer seene-utilities{");
    // Layer order is what carries the cascade, so the sequence must survive the rewrite.
    expect(result.indexOf("@layer seene-theme")).toBeLessThan(result.indexOf("@layer seene-base"));
    expect(result.indexOf("@layer seene-base")).toBeLessThan(result.indexOf("@layer seene-components"));
    expect(result.indexOf("@layer seene-components")).toBeLessThan(result.indexOf("@layer seene-utilities"));
  });

  it("accepts a custom prefix", () => {
    expect(namespaceCssLayers("@layer base{a{b:c}}", "lib-")).toBe("@layer lib-base{a{b:c}}");
  });
});
