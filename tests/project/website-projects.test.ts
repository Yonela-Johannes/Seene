import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WebsiteInspectionSchema, updateWebsiteProject, type WebsiteInspection } from "../../src/core";
import {
  readWebsiteProject,
  readWebsiteProjects,
  removeWebsiteProject,
  saveImportedWebsite,
  writeWebsiteProject,
  websiteDirectory,
} from "../../src/vite/website-projects";

const homes: string[] = [];

async function home(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "seene-websites-"));
  homes.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(homes.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

function inspection(): WebsiteInspection {
  return WebsiteInspectionSchema.parse({
    url: "https://example.com/",
    title: "Example",
    sections: [
      { id: "hero", label: "Hero", selector: "#hero" },
      { id: "features", label: "Features", selector: "#features" },
    ],
    pages: [
      { url: "https://example.com/", title: "Home", path: "/" },
      { url: "https://example.com/pricing", title: "Pricing", path: "/pricing" },
    ],
    interactiveElements: [
      { id: "signup", label: "Sign up", kind: "link", selector: "a.signup" },
    ],
    status: "ok",
    canIframe: true,
    inspectedWith: "browser",
  });
}

describe("saveImportedWebsite", () => {
  it("persists only discovered targets and keeps the requested order", async () => {
    const directory = await home();
    const project = await saveImportedWebsite(directory, {
      inspection: inspection(),
      title: "Guided tour",
      targets: [
        { kind: "section", id: "hero", label: "Ignored client label", selector: "#not-hero" },
        { kind: "section", id: "invented", label: "Not real" },
        { kind: "page", url: "https://example.com/pricing", title: "Pricing" },
        { kind: "page", url: "https://example.com/invented", title: "Not real" },
        { kind: "element", selector: "a.signup", label: "Sign up", action: "click" },
        { kind: "element", selector: "button.invented", label: "Not real" },
      ],
      now: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(project.url).toBe("https://example.com/");
    expect(project.walkthrough.nodes.map(node => node.type)).toEqual(["start", "show", "navigate", "click", "end"]);
    // Labels and selectors come from the inspection, not the request body.
    expect(project.walkthrough.nodes[1]).toMatchObject({
      title: "Hero",
      target: { kind: "section", sectionId: "hero", selector: "#hero" },
    });
    expect(project.walkthrough.nodes[2]).toMatchObject({
      title: "Pricing",
      target: { kind: "page", url: "https://example.com/pricing" },
    });
    expect(project.walkthrough.nodes[3]).toMatchObject({
      title: "Sign up",
      target: { kind: "element", selector: "a.signup" },
    });

    const stored = await readWebsiteProject(directory, "https://example.com/");
    expect(stored?.walkthrough).toEqual(project.walkthrough);
    expect(stored?.inspection).toEqual(project.inspection);
    expect(await readWebsiteProject(directory, "https://example.com")).not.toBeUndefined();
  });

  it("writes one json file under the websites directory", async () => {
    const directory = await home();
    const project = await saveImportedWebsite(directory, { inspection: inspection() });
    const listed = await readWebsiteProjects(directory);
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(project.id);
    expect(websiteDirectory(directory)).toBe(path.join(directory, "websites"));

    const updated = updateWebsiteProject(project, { title: "Renamed", now: new Date("2026-02-01T00:00:00.000Z") });
    await writeWebsiteProject(directory, updated);
    const reread = await readWebsiteProject(directory, project.url);
    expect(reread?.title).toBe("Renamed");
    expect(reread?.url).toBe(project.url);
    expect(reread?.createdAt).toBe(project.createdAt);
  });

  it("removes a stored project and reports missing files", async () => {
    const directory = await home();
    await saveImportedWebsite(directory, { inspection: inspection() });
    expect(await removeWebsiteProject(directory, "https://example.com/")).toBe(true);
    expect(await readWebsiteProject(directory, "https://example.com/")).toBeUndefined();
    expect(await removeWebsiteProject(directory, "https://example.com/")).toBe(false);
    expect(await removeWebsiteProject(directory, "not-a-url")).toBe(false);
  });

  it("rejects invalid and blocked URLs before writing", async () => {
    const directory = await home();
    const blocked = WebsiteInspectionSchema.parse({
      url: "http://169.254.169.254/latest/meta-data",
      title: "metadata",
    });
    await expect(saveImportedWebsite(directory, { inspection: blocked })).rejects.toThrow(/reserved for internal services/);
    expect(await readWebsiteProjects(directory)).toEqual([]);
  });
});
