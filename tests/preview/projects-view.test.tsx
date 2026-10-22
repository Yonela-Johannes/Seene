// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectsView } from "../../src/platform/ProjectsView";
import { websiteStudioHref } from "../../src/platform/api";
import { installLayoutStubs } from "../helpers/layout";

const WEBSITE = {
  id: "example-com",
  url: "https://example.com/",
  title: "Example Studio",
  description: "A tour of the example site",
  sectionCount: 2,
  pageCount: 3,
  stepCount: 5,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const calls: Array<{ url: string; method: string }> = [];

function installFetch(websites = [WEBSITE]) {
  let current = websites;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ url, method });
    if (method === "GET" && /\/projects$/.test(url)) {
      return { ok: true, status: 200, json: async () => ({ home: "/home/x/.seene", projects: [] }) } as unknown as Response;
    }
    if (method === "GET" && /\/websites$/.test(url)) {
      return { ok: true, status: 200, json: async () => ({ projects: current }) } as unknown as Response;
    }
    if (method === "GET" && /\/projects\/sources\/discover/.test(url)) {
      return { ok: true, status: 200, json: async () => ({ home: "/home/x/.seene", roots: [], projects: [], scanned: 0, truncated: false }) } as unknown as Response;
    }
    if (method === "DELETE" && /\/websites\/project/.test(url)) {
      current = [];
      return { ok: true, status: 200, json: async () => ({ projects: [] }) } as unknown as Response;
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

describe("projects view website walkthroughs", () => {
  it("lists saved website projects and opens the website studio", async () => {
    installFetch();
    render(<ProjectsView />);

    expect(await screen.findByRole("heading", { name: "Website walkthroughs" })).toBeTruthy();
    expect(await screen.findByText("Example Studio")).toBeTruthy();
    expect(screen.getByText("https://example.com/")).toBeTruthy();
    const open = screen.getByRole("link", { name: "Open studio" });
    expect(open.getAttribute("href")).toBe(websiteStudioHref("https://example.com/"));
  });

  it("removes a saved website walkthrough after confirmation", async () => {
    installFetch();
    render(<ProjectsView />);

    await screen.findByText("Example Studio");
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm remove" }));

    await waitFor(() => {
      expect(calls.some(call => call.method === "DELETE" && /\/websites\/project\?url=/.test(call.url))).toBe(true);
    });
    expect(await screen.findByText("No website walkthroughs yet")).toBeTruthy();
  });

  it("explains the empty state without pretending a site exists", async () => {
    installFetch([]);
    render(<ProjectsView />);
    expect(await screen.findByText("No website walkthroughs yet")).toBeTruthy();
  });
});
