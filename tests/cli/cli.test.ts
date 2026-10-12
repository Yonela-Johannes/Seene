import { describe, it, expect, vi } from "vitest";
vi.mock("../../src/project/commands", () => ({executeProjectCommand: vi.fn()}));
import { runCli } from "../../src/cli";
import type { ProjectResult } from "../../src/core";
import { SEENE_BRAND } from "../../src/core/branding";
import { RESOURCES } from "../../src/core/resources";
const ready: ProjectResult = {success:true,data:{project:{version:1,projectId:"00000000-0000-4000-8000-000000000000",entry:"src/main.tsx",packageManager:"npm"}}};
const context = {root:"/project"};
describe("CLI adapter", () => {
  it("has side-effect-free help", async () => {
    const execute = vi.fn();
    const help = (await runCli(["--help"], context, execute)).stdout;
    for (const text of ["npx @thatg33k/seene init", SEENE_BRAND.title, SEENE_BRAND.url, "--package accepts a local .tgz", "SEENE.md", "must be mounted manually"])
      expect(help).toContain(text);
    expect(execute).not.toHaveBeenCalled();
  });
  it.each([["wat"],["init","--wat"],["init","--project"],["init","--url","--json"],["init","--json","--json"],["init","--no-open"],["validate","--package","x"],["load","--url","x"]])("rejects malformed args %j before executing", async (...args) => {
    const execute=vi.fn();
    expect((await runCli(args,context,execute)).code).toBe(2);
    expect(execute).not.toHaveBeenCalled();
  });
  it("initializes then opens through the same command boundary", async () => {
    const execute=vi.fn().mockResolvedValueOnce(ready).mockResolvedValueOnce({success:true,data:{url:"http://127.0.0.1:6199/?seene-preview=1"}});
    const r=await runCli(["init","--project","/host","--package","/tmp/pkg.tgz","--url","http://127.0.0.1:6199","--no-open","--json"],context,execute);
    expect(execute.mock.calls).toEqual([
      ["init-project",{packageSource:"/tmp/pkg.tgz"},{root:"/host"}],
      ["open-preview",{url:"http://127.0.0.1:6199",launch:false},{root:"/host"}],
    ]);
    expect(r.code).toBe(0);expect(JSON.parse(r.stdout).data.url).toContain("seene-preview");
  });
  it("prints the manual mount requirement during non-JSON initialization", async () => {
    const execute = vi.fn().mockResolvedValue({ success: true, data: {
      project: { version: 1, projectId: "00000000-0000-4000-8000-000000000000", entry: "src/seene/ProjectPreview.jsx", packageManager: "npm", adapter: "react" },
      integration: { kind: "react", component: "src/seene/ProjectPreview.jsx", instructions: "Manual integration required: mount SeeneProjectPreview with a development-only enabled prop before opening." },
    } });
    const result = await runCli(["init"], context, execute);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Manual integration required");
    expect(result.stdout).toContain("development-only enabled prop");
  });
  it("does not open after failed init", async () => {
    const execute=vi.fn().mockResolvedValue({success:false,issues:[{code:"unsupported",message:"Use a Vite React project."}]});
    const r=await runCli(["init","--url","http://127.0.0.1:1234"],context,execute);
    expect(execute).toHaveBeenCalledTimes(1);expect(r.code).toBe(1);expect(r.stderr).toContain("Use a Vite");
  });
  it("uses configured port and passes validation to trusted operation", async () => {
    const execute=vi.fn().mockResolvedValue(ready);
    await runCli(["open","--no-open"],{...context,port:"62123"},execute);
    expect(execute).toHaveBeenCalledWith("open-preview",{url:"http://127.0.0.1:62123",launch:false},context);
  });
  it("loads without starting a preview", async () => {
    const execute=vi.fn().mockResolvedValue(ready);
    expect((await runCli(["load"],context,execute)).code).toBe(0);
    expect(execute).toHaveBeenCalledWith("load-project",{},context);
  });
  it("reports an unexpected failure without dumping credentials", async () => {
    const execute=vi.fn().mockRejectedValue(new Error("secret value"));
    const r=await runCli(["init"],context,execute);
    expect(r.code).toBe(1);expect(r.stderr).not.toContain("secret value");
  });
  it("includes catalog warnings in validate json output and text summary", async () => {
    const execute = vi.fn().mockResolvedValue({
      success: true,
      data: {
        project: ready.success ? ready.data.project : undefined,
        catalog: {
          scenes: [],
          issues: [],
          warnings: [{ path: "src/seene/scenes/demo.tsx", message: "Surface inspection note: Uses dynamic computed ID" }],
        },
      },
    });
    const jsonResult = await runCli(["validate", "--json"], context, execute);
    expect(jsonResult.code).toBe(0);
    const parsed = JSON.parse(jsonResult.stdout);
    expect(parsed.data.catalog.warnings).toHaveLength(1);
    expect(parsed.data.catalog.warnings[0].message).toContain("dynamic computed ID");
  });
});

describe("studio onboarding CLI", () => {
  const handoff = { path: "SEENE.md" as const, guideCommand: "pnpm exec seene guide --json" as const,
    guideVersion: RESOURCES["authoring-guide"]().version,
    prompt: "Open the Seene studio." };
  const initialized: ProjectResult = { success: true, data: { ...ready.success && ready.data, changed: true, handoff } };
  it("prints studio confirmation for a locally installed package", async () => {
    const execute = vi.fn().mockResolvedValue(initialized);
    const result = await runCli(["init"], context, execute);
    expect(execute).toHaveBeenCalledExactlyOnceWith("init-project", {}, context);
    expect(result.code).toBe(0);
    for (const text of [SEENE_BRAND.title, SEENE_BRAND.url, "SEENE.md"])
      expect(result.stdout).toContain(text);
  });
  it("preserves handoff metadata when init also opens the preview", async () => {
    const execute = vi.fn().mockResolvedValueOnce(initialized).mockResolvedValueOnce({ success: true, data: { url: "http://localhost:5173/?seene-preview=1" } });
    const result = await runCli(["init", "--url", "http://localhost:5173", "--no-open", "--json"], context, execute);
    expect(JSON.parse(result.stdout).data).toMatchObject({ handoff, changed: true, url: "http://localhost:5173/?seene-preview=1" });
    expect(result.stdout).not.toContain(SEENE_BRAND.title);
  });
  it("keeps completed onboarding visible when the existing server is unavailable", async () => {
    const execute = vi.fn().mockResolvedValueOnce(initialized).mockResolvedValueOnce({ success: false, issues: [{ code: "missing-dev-server", message: "Run npm run dev and retry." }] });
    const result = await runCli(["init", "--url", "http://localhost:5173"], context, execute);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain("SEENE.md");
    expect(result.stderr).toContain("Run npm run dev");
  });
  it("prints file conflicts with their actionable path and keeps JSON canonical", async () => {
    const failure = { success: false, issues: [{ code: "conflict", path: "SEENE.md", message: "Move or rename the document and retry." }] };
    const execute = vi.fn().mockResolvedValue(failure);
    const plainResult = await runCli(["init"], context, execute);
    expect(plainResult.code).toBe(1);
    expect(plainResult.stderr).toContain("conflict (SEENE.md)");
    const jsonResult = await runCli(["init", "--json"], context, execute);
    expect(jsonResult.code).toBe(1);
    expect(JSON.parse(jsonResult.stderr)).toEqual(failure);
  });
});
