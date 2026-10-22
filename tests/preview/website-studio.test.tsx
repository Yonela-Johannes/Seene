// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebsiteInspectionSchema, createWalkthroughFromWebsite, type WebsiteProject } from "../../src/core";
import { WebsiteStudioView } from "../../src/platform/WebsiteStudioView";
import { websiteStudioHref } from "../../src/platform/api";
import { installLayoutStubs } from "../helpers/layout";

const INSPECTION = WebsiteInspectionSchema.parse({
  url: "https://example.com/",
  title: "Example Studio",
  sections: [
    { id: "hero", label: "Hero", selector: "#hero" },
    { id: "features", label: "Features", selector: "#features" },
  ],
  pages: [{ url: "https://example.com/pricing", title: "Pricing", path: "/pricing" }],
  interactiveElements: [{ id: "signup", label: "Sign up", kind: "link", selector: "a.signup" }],
  status: "ok",
  canIframe: true,
  inspectedWith: "browser",
});

function project(): WebsiteProject {
  return {
    version: 1,
    id: "example-com",
    url: "https://example.com/",
    title: "Example Studio",
    inspection: INSPECTION,
    walkthrough: createWalkthroughFromWebsite({
      url: "https://example.com/",
      title: "Example Studio",
      sections: [
        { id: "hero", label: "Hero", selector: "#hero" },
        { id: "features", label: "Features", selector: "#features" },
      ],
    }),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const calls: Array<{ url: string; method: string; body?: unknown }> = [];

function installFetch(projectValue: WebsiteProject = project()) {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ url, method, ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
    if (method === "GET" && url.includes("/websites/project")) {
      return { ok: true, status: 200, json: async () => ({ project: projectValue }) } as unknown as Response;
    }
    if (method === "PUT" && url.includes("/websites/project")) {
      return { ok: true, status: 200, json: async () => ({ project: projectValue }) } as unknown as Response;
    }
    return { ok: false, status: 404, json: async () => ({ error: "not found" }) } as unknown as Response;
  }));
}

beforeEach(() => {
  calls.length = 0;
  installLayoutStubs();
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("website studio", () => {
  it("loads a saved website walkthrough into the shared sequence, preview and inspector", async () => {
    installFetch();
    const { container } = render(<WebsiteStudioView url="https://example.com/" />);

    expect(await screen.findByLabelText("Walkthrough sequence")).toBeTruthy();
    const labels = [...container.querySelectorAll(".seene-studio-node-title")].map(node => node.textContent);
    expect(labels).toEqual(["Open website", "Hero", "Features", "Product demonstration complete"]);
    expect(screen.getByLabelText("Website preview")).toBeTruthy();
    expect(screen.getByLabelText("Walkthrough inspector")).toBeTruthy();
    expect((screen.getByLabelText("Walkthrough title") as HTMLInputElement).value).toBe("Example Studio");
  });

  it("adds a discovered page as a navigation step and autosaves the shared document", async () => {
    installFetch();
    const { container } = render(<WebsiteStudioView url="https://example.com/" />);
    await screen.findByLabelText("Walkthrough sequence");

    fireEvent.click(screen.getByRole("button", { name: "+ Add" }));
    const dialog = await screen.findByRole("dialog", { name: "Add website step" });
    fireEvent.click(screen.getByRole("button", { name: "Pages" }));
    fireEvent.click(await screen.findByRole("button", { name: /Pricing/ }));

    await waitFor(() => expect(container.querySelectorAll(".seene-studio-node")).toHaveLength(5));
    await waitFor(() => {
      const saved = calls.find(call => call.method === "PUT");
      expect(saved).toBeTruthy();
      const walkthrough = (saved?.body as { walkthrough: { nodes: Array<{ type: string; target?: { url?: string } }> } }).walkthrough;
      expect(walkthrough.nodes.some(node => node.type === "navigate" && node.target?.url === "https://example.com/pricing")).toBe(true);
    }, { timeout: 3000 });
  }, 15000);

  it("shows the inspection snapshot when a site blocks iframes and says why", async () => {
    const blocked: WebsiteProject = {
      ...project(),
      inspection: WebsiteInspectionSchema.parse({
        ...INSPECTION,
        canIframe: false,
        status: "iframe-blocked",
        fallbackReason: "The site sends X-Frame-Options: DENY.",
        previewImage: "data:image/jpeg;base64,AAAA",
      }),
    };
    installFetch(blocked);
    render(<WebsiteStudioView url="https://example.com/" />);

    const image = await screen.findByRole("img", { name: /Inspected snapshot of Example Studio/ });
    expect(image.getAttribute("src")).toBe("data:image/jpeg;base64,AAAA");
    expect(screen.getByText("The site sends X-Frame-Options: DENY.")).toBeTruthy();
  });

  it("opens the same route helper the import flow redirects to", () => {
    expect(websiteStudioHref("https://example.com/")).toBe("#/websites/https%3A%2F%2Fexample.com%2F");
  });
});
