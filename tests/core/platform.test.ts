import { describe, expect, it } from "vitest";
import { applicationFileReadiness, isLoopbackHost, validateHostComponent } from "../../src/core/platform";

describe("application file readiness", () => {
  it("reports route files as not previewable and explains why", () => {
    const result = applicationFileReadiness("app/dashboard/page.tsx", { default: true, exports: ["Page"] });
    expect(result.previewable).toBe(false);
    expect(result.issue).toMatch(/Route files/);
  });

  it("reports generated Seene wrappers as not previewable", () => {
    const result = applicationFileReadiness("src/seene/scenes/hero.tsx", { default: true, exports: [] });
    expect(result.previewable).toBe(false);
    expect(result.issue).toMatch(/generated/);
  });

  it("reports async Server Components as not previewable", () => {
    const result = applicationFileReadiness(
      "src/Feed.tsx",
      { default: true, exports: [] },
      "export default async function Feed() { return null; }",
    );
    expect(result.previewable).toBe(false);
    expect(result.issue).toMatch(/Server Components/);
  });

  it("reports files without a component export", () => {
    const result = applicationFileReadiness("src/tokens.ts", { default: false, exports: [] });
    expect(result.previewable).toBe(false);
    expect(result.issue).toMatch(/no component/);
  });

  it("accepts default exports and named-only exports", () => {
    expect(applicationFileReadiness("src/components/Hero.tsx", { default: true, exports: [] }).previewable).toBe(true);
    expect(applicationFileReadiness("src/components/Hero.tsx", { default: false, exports: ["Hero"] }).previewable).toBe(true);
  });
});

describe("host component validation", () => {
  it("accepts a default export when no named export is requested", () => {
    expect(validateHostComponent("src/Hero.tsx", "export default function Hero() {}")).toEqual({ valid: true, warning: undefined });
  });

  it("accepts a requested named export", () => {
    const source = "export const Hero = () => null;\nexport const Button = () => null;";
    expect(validateHostComponent("src/lib.tsx", source, "Hero")).toEqual({ valid: true, warning: undefined });
    expect(validateHostComponent("src/lib.tsx", source, "Button")).toEqual({ valid: true, warning: undefined });
  });

  it("rejects a requested named export that does not exist", () => {
    expect(() => validateHostComponent("src/lib.tsx", "export const Hero = () => null;", "Missing")).toThrow('has no export named "Missing"');
  });

  it("still requires a default export when none is requested", () => {
    expect(() => validateHostComponent("src/lib.tsx", "export const Hero = () => null;")).toThrow("has no default export");
  });
});

describe("loopback host guard for source browsing", () => {
  it("accepts loopback hosts", () => {
    for (const host of ["127.0.0.1:5173", "localhost:3000", "[::1]:4173", "0.0.0.0:4173", undefined]) {
      expect(isLoopbackHost(host)).toBe(true);
    }
  });

  it("rejects hosts reachable from another machine", () => {
    for (const host of ["example.com", "192.168.1.5:5173", "seene.dev:443", "10.0.0.4"]) {
      expect(isLoopbackHost(host)).toBe(false);
    }
  });
});
