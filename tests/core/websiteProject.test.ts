import { describe, expect, it } from "vitest";
import {
  WebsiteInspectionSchema,
  createWebsiteProject,
  summarizeWebsiteProject,
  updateWebsiteProject,
  websiteProjectId,
} from "../../src/core";

const INSPECTION = WebsiteInspectionSchema.parse({
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

describe("websiteProjectId", () => {
  it("is stable for equivalent normalized URLs", () => {
    expect(websiteProjectId("https://example.com/")).toBe(websiteProjectId("https://example.com/"));
    expect(websiteProjectId("https://example.com/a")).not.toBe(websiteProjectId("https://example.com/b"));
    expect(websiteProjectId("https://example.com/")).toMatch(/^[a-z0-9-]+$/);
  });
});

describe("createWebsiteProject", () => {
  it("keeps the source URL and builds an ordered walkthrough from the selected targets", () => {
    const project = createWebsiteProject({
      inspection: INSPECTION,
      title: "Guided tour",
      targets: [
        { kind: "section", id: "hero", label: "Hero", selector: "#hero" },
        { kind: "page", url: "https://example.com/pricing", title: "Pricing" },
        { kind: "element", selector: "a.signup", label: "Sign up" },
      ],
      now: new Date("2026-01-02T03:04:05.000Z"),
    });

    expect(project.url).toBe("https://example.com/");
    expect(project.title).toBe("Guided tour");
    expect(project.walkthrough.nodes.map(node => node.type)).toEqual(["start", "show", "navigate", "show", "end"]);
    expect(project.walkthrough.nodes[1].target).toMatchObject({ kind: "section", sectionId: "hero" });
    expect(project.walkthrough.nodes[2].target).toMatchObject({ kind: "page", url: "https://example.com/pricing" });
    expect(project.walkthrough.nodes[3].target).toMatchObject({ kind: "element", selector: "a.signup" });
    expect(project.createdAt).toBe("2026-01-02T03:04:05.000Z");
    expect(summarizeWebsiteProject(project)).toMatchObject({
      url: "https://example.com/",
      sectionCount: 2,
      pageCount: 2,
      stepCount: 5,
    });
  });

  it("does not fabricate sections when an inspection finds none", () => {
    const project = createWebsiteProject({
      inspection: WebsiteInspectionSchema.parse({
        url: "https://empty.example/",
        title: "Empty",
      }),
    });

    expect(project.walkthrough.nodes.map(node => node.type)).toEqual(["start", "end"]);
  });
});

describe("updateWebsiteProject", () => {
  it("preserves the original URL, creation time and inspection", () => {
    const project = createWebsiteProject({
      inspection: INSPECTION,
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    const updated = updateWebsiteProject(project, {
      title: "Renamed",
      description: "A better description",
      now: new Date("2026-01-02T00:00:00.000Z"),
    });

    expect(updated.url).toBe(project.url);
    expect(updated.id).toBe(project.id);
    expect(updated.createdAt).toBe(project.createdAt);
    expect(updated.updatedAt).toBe("2026-01-02T00:00:00.000Z");
    expect(updated.inspection).toEqual(project.inspection);
    expect(updated.title).toBe("Renamed");
    expect(updated.description).toBe("A better description");
  });
});
